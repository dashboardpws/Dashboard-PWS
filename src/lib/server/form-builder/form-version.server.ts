import { and, count, desc, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/server/db.server'
import { formVersions, forms, surveys } from '@/lib/schema/schema'
import { parseFormDefinition } from '@/lib/form-builder/form-schema'
import {
  validasiEdisiVersi,
  validasiHapusDraftVersi,
  validasiTerbitkanVersi,
} from '@/lib/service/form-builder/validasi'
import type {
  HasilValidasi,
  KodeValidasi,
  RingkasanHapusDraft,
} from '@/lib/service/form-builder/validasi'
import { catatAudit } from './audit.server'

/**
 * Error validasi Form Builder. Dibedakan dari error lain supaya route bisa
 * membalas 400 dengan pesan yang bisa ditampilkan ke petugas, bukan 500.
 */
export class KesalahanValidasi extends Error {
  readonly kode: KodeValidasi
  readonly status = 400

  constructor(hasil: Extract<HasilValidasi, { ok: false }>) {
    super(hasil.pesan)
    this.name = 'KesalahanValidasi'
    this.kode = hasil.kode
  }
}

function pastikan(hasil: HasilValidasi): void {
  if (!hasil.ok) throw new KesalahanValidasi(hasil)
}

function hitungStruktur(schemaValue: unknown) {
  const schema = parseFormDefinition(schemaValue)
  return {
    jumlahSection: schema.sections.length,
    jumlahField: schema.sections.reduce(
      (total, section) => total + section.fields.length,
      0,
    ),
  }
}

type Db = typeof db
/**
 * Handle transaksi dari `db.transaction(...)`. Diturunkan dari tipe `db` sendiri
 * supaya tidak perlu paket atau file lain hanya untuk satu alias.
 */
type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0]
/**
 * Kueri boleh jalan di koneksi biasa (`db`) atau di transaksi yang sedang
 * berjalan. Dipakai pemanggil yang menerima transaksi dari luar supaya seluruh
 * pekerjaannya ikut commit/rollback bersama pemanggil.
 */
type Executor = Db | DbTx

async function ambilStatusVersi(
  executor: Pick<Db, 'select'>,
  formVersionId: string,
): Promise<string | null> {
  const baris = await executor
    .select({ status: formVersions.status })
    .from(formVersions)
    .where(eq(formVersions.id, formVersionId))
    .limit(1)
  return baris[0]?.status ?? null
}

/**
 * Dipanggil sebelum setiap perubahan struktur (section, field, pilihan jawaban).
 * Ini penjaga utama "versi published tidak diedit langsung": begitu published,
 * struktur form membeku dan perubahan harus lewat versi baru.
 */
export async function assertVersiBisaDiubah(
  formVersionId: string,
  executor: Pick<Db, 'select'> = db,
): Promise<void> {
  pastikan(validasiEdisiVersi(await ambilStatusVersi(executor, formVersionId)))
}

/**
 * Terbitkan satu versi form.
 *
 * Satu form hanya boleh punya satu versi `published`. Aturan itu dijaga di sini:
 * versi published lama DIARSIPKAN lebih dulu, lalu versi baru ditulis, dan
 * keduanya dalam satu transaksi. Kalau archiving tidak dilakukan, form punya
 * dua versi published dan pemanggil seperti `daftarFormulirTerisi()` akan
 * menampilkan form yang sama dua kali.
 *
 * Transaksi dipakai karena archiving lalu publishing harus atomik: kalau tidak,
 * ada celah di mana form tidak punya versi published sama sekali dan petugas
 * yang sedang mengisi survei tidak bisa memuat definisi form.
 *
 * Kunci baris `for update` di bawah mencegah dua publish paralel mengarsipkan
 * versi published yang sama. Kalau nanti aturan ini perlu ditegakkan database
 * juga, partial unique index-nya satu baris: `create unique index
 * form_versions_one_published_per_form on form_versions (formId) where status =
 * 'published';`
 */
export async function terbitkanVersiForm(
  formVersionId: string,
  opts: { actorId?: string | null; now?: Date } = {},
): Promise<{ formId: number; version: number; publishedAt: Date }> {
  const now = opts.now ?? new Date()

  const hasil = await db.transaction(async (tx) => {
    // Kunci baris versi dulu supaya dua publish paralel tidak sama-sama membaca
    // status lama lalu sama-sama memutuskan untuk mengarsipkan versi yang sama.
    // Satu-satunya tempat publish dilindungi dari konkurensi.
    await tx.execute(
      sql`select 1 from form_versions where id = ${formVersionId} for update`,
    )

    const target = await tx
      .select({
        formId: formVersions.formId,
        version: formVersions.version,
        status: formVersions.status,
      })
      .from(formVersions)
      .where(eq(formVersions.id, formVersionId))
      .limit(1)

    const versi = target[0]
    if (!versi) {
      throw new KesalahanValidasi({
        ok: false,
        kode: 'VERSI_TIDAK_ADA',
        pesan: 'Form versi tidak ditemukan.',
      })
    }
    pastikan(validasiTerbitkanVersi(versi.status))

    // publishedAt ikut dikosongkan saat diarsipkan. Ini aman karena check
    // constraint hanya mewajibkan publishedAt pada baris berstatus 'published'.
    await tx
      .update(formVersions)
      .set({ status: 'archived', publishedAt: null, updatedAt: now })
      .where(
        and(
          eq(formVersions.formId, versi.formId),
          eq(formVersions.status, 'published'),
        ),
      )

    await tx
      .update(formVersions)
      .set({ status: 'published', publishedAt: now, updatedAt: now })
      .where(eq(formVersions.id, formVersionId))

    return { formId: versi.formId, version: versi.version, publishedAt: now }
  })

  // Audit ditulis DI LUAR transaksi. Kalau publish dibatalkan, tidak boleh ada
  // jejak audit yang menyatakan versi tayang padahal sebenarnya tidak tayang.
  await catatAudit({
    userId: opts.actorId ?? null,
    aksi: 'publish',
    entitas: 'form_versions',
    entitasId: formVersionId,
    sesudah: {
      status: 'published',
      version: hasil.version,
      publishedAt: hasil.publishedAt.toISOString(),
    },
  })

  return hasil
}

/**
 * Versi asal yang strukturnya akan disalin ke draft baru.
 *
 * Kalau `dariVersiId` diberikan, versinya divalidasi dulu: sumber dari form lain
 * harus ditolak, bukan diam-diam menghasilkan draft kosong. Tanpa sumber
 * eksplisit, dipakai versi published terbaru supaya perubahan tayang tidak
 * hilang. Form yang belum pernah tayang memang tidak punya sumber, dan itu
 * bukan error: draft-nya tetap dibuat kosong.
 */
async function cariVersiAsal(
  executor: Executor,
  formId: number,
  dariVersiId: string | undefined,
): Promise<string | null> {
  if (dariVersiId) {
    const asal = await executor
      .select({ formId: formVersions.formId })
      .from(formVersions)
      .where(eq(formVersions.id, dariVersiId))
      .limit(1)
    const baris = asal[0]
    if (!baris || baris.formId !== formId) {
      throw new KesalahanValidasi({
        ok: false,
        kode: 'VERSI_TIDAK_ADA',
        pesan: 'Versi asal tidak ditemukan atau bukan milik form ini.',
      })
    }
    return dariVersiId
  }

  const terbaru = await executor
    .select({ id: formVersions.id })
    .from(formVersions)
    .where(
      and(
        eq(formVersions.formId, formId),
        eq(formVersions.status, 'published'),
      ),
    )
    .orderBy(desc(formVersions.version))
    .limit(1)

  return terbaru[0]?.id ?? null
}

/**
 * Salin struktur (section, field, pilihan jawaban) dari satu versi ke versi baru.
 *
 * Semuanya bulk insert: form nyata punya ratusan field, jadi insert per baris
 * akan jadi ratusan round-trip ke database. Id baru dipetakan ke id lama
 * karena `form_fields.sectionId` menunjuk baris versi asal, sedangkan versi baru
 * harus hanya menunjuk baris versi baru.
 */
async function salinStruktur(
  executor: Executor,
  formVersionIdBaru: string,
  formVersionIdAsal: string,
  version: number,
): Promise<void> {
  const [asal] = await executor
    .select({ schema: formVersions.schema })
    .from(formVersions)
    .where(eq(formVersions.id, formVersionIdAsal))
    .limit(1)
  if (!asal) return

  const schemaAsal = parseFormDefinition(asal.schema)
  await executor
    .update(formVersions)
    .set({
      schema: { ...schemaAsal, version },
      updatedAt: new Date(),
    })
    .where(eq(formVersions.id, formVersionIdBaru))
}

/**
 * Buat draft berikutnya dari versi yang ada.
 *
 * Dipakai saat admin mau mengubah form yang sudah tayang: versi published lama
 * dibekukan (lihat assertVersiBisaDiubah), jadi perubahan harus punya tempat
 * baru. Nomor versi dihitung dari yang terbesar, bukan dari jumlah baris, supaya
 * aman dari versi archived bernomor lebih besar. Dengan begitu penomoran selalu
 * naik dan tidak bentrok dengan unique index (formId, version).
 *
 * `opts.tx` dipakai pemanggil yang sudah punya transaksi sendiri. Tanpa itu
 * fungsi ini membuka `db.transaction` baru, yang mengambil koneksi pool lain
 * dan tidak melihat baris yang belum commit pemanggil — termasuk baris `forms`
 * baru, sehingga insert versi gagal FK.
 */
export async function buatDraftBerikutnya(
  formId: number,
  opts: { dariVersiId?: string; tx?: DbTx } = {},
): Promise<string> {
  const buat = async (executor: Executor): Promise<string> => {
    const versiAsalId = await cariVersiAsal(executor, formId, opts.dariVersiId)

    const [tertinggi] = await executor
      .select({ maks: sql<number>`coalesce(max(${formVersions.version}), 0)` })
      .from(formVersions)
      .where(eq(formVersions.formId, formId))

    const version = (tertinggi?.maks ?? 0) + 1
    const baris = await executor
      .insert(formVersions)
      .values({
        formId,
        version,
        status: 'draft',
        schema: { version, sections: [] },
      })
      .returning({ id: formVersions.id })

    const baru = baris[0]
    if (!baru) {
      throw new KesalahanValidasi({
        ok: false,
        kode: 'VERSI_TIDAK_ADA',
        pesan: 'Gagal membuat draft versi form.',
      })
    }

    // Struktur ikut disalin supaya petugas mengubah form yang sudah ada dari
    // isian yang sudah ada, bukan dari layar kosong.
    if (versiAsalId) {
      await salinStruktur(executor, baru.id, versiAsalId, version)
    }

    return baru.id
  }

  // Transaksi dibuka tepat satu kali: kalau pemanggil sudah memberi `tx`,
  // membuka `db.transaction` kedua akan memecah atomisitasnya.
  return opts.tx ? await buat(opts.tx) : await db.transaction(buat)
}

/** Hasil hapus draft, supaya UI bisa menyebut angka yang benar-benar hilang. */
export interface HasilHapusDraftVersi {
  jumlahSection: number
  jumlahField: number
  jumlahVersiSisa: number
}

/**
 * Isi satu versi draft, dipakai dialog konfirmasi sebelum dihapus.
 *
 * Dipisah dari `hapusDraftVersiForm` supaya admin bisa melihat angka yang akan
 * hilang tanpa harus menekan tombol dulu. Server tetap yang menghitungnya —
 * angka dari klien bisa saja kedaluwarsa di antara dialog dibuka dan tombol
 * ditekan, jadi `hapusDraftVersiForm` menghitung ulang sendiri.
 */
export async function ringkasanHapusDraftVersiForm(
  formVersionId: string,
): Promise<RingkasanHapusDraft> {
  const [baris] = await db
    .select({
      jumlahSubmit: sql<number>`(
        select count(*)::int from ${surveys}
        where ${surveys.formVersionId} = ${formVersionId}
      )`,
      schema: formVersions.schema,
    })
    .from(formVersions)
    .where(eq(formVersions.id, formVersionId))
    .limit(1)

  if (!baris) {
    throw new KesalahanValidasi({
      ok: false,
      kode: 'VERSI_TIDAK_ADA',
      pesan: 'Form versi tidak ditemukan.',
    })
  }

  return { jumlahSubmit: baris.jumlahSubmit, ...hitungStruktur(baris.schema) }
}

/**
 * Hapus satu versi draft beserta seluruh isinya di database.
 *
 * Yang ikut terhapus: section, field, dan pilihan jawaban. Ketiganya cascade
 * dari `form_versions`, jadi tidak perlu dihapus manual — cascade inilah yang
 * membuat `form_field_options` ikut hilang lewat `form_fields`, bukan langsung
 * dari versi.
 *
 * Dua lapis penjaga, keduanya ditegakkan ulang di sini walau `validasiHapusDraftVersi`
 * sudah dipanggil sebelumnya. Pemeriksaan ganda itu murah dibanding satu draft
 * bawaan yang terhapus: `buildFormVersion` hanya bisa memulihkan struktur dari
 * template lokal, bukan dari draft yang sudah hilang, dan form bawaan yang
 * gagal render membuat seluruh form kader tidak bisa dipakai.
 *
 * `surveys` dihapus eksplisit lebih dulu meski validasi sudah menolak draft
 * berisian. FK `surveys.formVersionId` tidak meng-cascade, jadi kalau suatu saat
 * ada jalur yang somehow menulis isian ke versi draft, penghapusan akan gagal
 * dengan pelanggaran FK — dan itu memang hasil yang benar: isian tidak boleh
 * hilang diam-diam bersama draft.
 *
 * Audit ditulis setelah transaksi selesai, mengikuti `terbitanVersiForm`: kalau
 * insert audit gagal, draftnya sudah benar-benar terhapus, dan menolak penghapusan
 * demi audit hanya akan membuat admin bingung.
 */
export async function hapusDraftVersiForm(
  formVersionId: string,
  opts: { actorId?: string | null } = {},
): Promise<HasilHapusDraftVersi> {
  const hasil = await db.transaction(async (tx) => {
    // Kunci baris versi supaya dua hapus paralel tidak sama-sama lolos
    // pemeriksaan "versi ini masih ada" lalu sama-sama DELETE.
    await tx.execute(
      sql`select 1 from form_versions where id = ${formVersionId} for update`,
    )

    const [versi] = await tx
      .select({
        formId: formVersions.formId,
        version: formVersions.version,
        status: formVersions.status,
        kodeForm: forms.kode,
      })
      .from(formVersions)
      .innerJoin(forms, eq(forms.id, formVersions.formId))
      .where(eq(formVersions.id, formVersionId))
      .limit(1)

    if (!versi) {
      throw new KesalahanValidasi({
        ok: false,
        kode: 'VERSI_TIDAK_ADA',
        pesan: 'Form versi tidak ditemukan.',
      })
    }

    const [hitungVersi] = await tx
      .select({ total: count() })
      .from(formVersions)
      .where(eq(formVersions.formId, versi.formId))
    const jumlahVersi = hitungVersi?.total ?? 0

    // Hitung di dalam transaksi yang sama supaya angka `jumlahVersi` benar
    // pada saat barisnya dikunci. Count di luar transaksi bisa melihat versi
    // yang baru saja dihapus oleh sesi lain.
    const [ringkasan] = await tx
      .select({
        jumlahSubmit: sql<number>`(
          select count(*)::int from ${surveys}
          where ${surveys.formVersionId} = ${formVersionId}
        )`,
        schema: formVersions.schema,
      })
      .from(formVersions)
      .where(eq(formVersions.id, formVersionId))
      .limit(1)

    // Baris versi sudah terkunci `for update` di atas, jadi select ini pasti
    // menemukan tepat satu baris. Tidak ada fallback: kalau barisnya hilang,
    // itu kondisi yang tidak mungkin dan menutupinya dengan angka nol membuat
    // pesan penolakan salah menyalahkan isian yang sebenarnya nol.
    if (!ringkasan) {
      throw new KesalahanValidasi({
        ok: false,
        kode: 'VERSI_TIDAK_ADA',
        pesan: 'Form versi tidak ditemukan.',
      })
    }
    const angka = {
      jumlahSubmit: ringkasan.jumlahSubmit,
      ...hitungStruktur(ringkasan.schema),
    }

    pastikan(
      validasiHapusDraftVersi({
        status: versi.status,
        kodeForm: versi.kodeForm,
        jumlahVersi,
        ringkasan: angka,
      }),
    )

    await tx.delete(surveys).where(eq(surveys.formVersionId, formVersionId))
    await tx.delete(formVersions).where(eq(formVersions.id, formVersionId))

    return {
      jumlahSection: angka.jumlahSection,
      jumlahField: angka.jumlahField,
      jumlahVersiSisa: jumlahVersi - 1,
    }
  })

  await catatAudit({
    userId: opts.actorId ?? null,
    aksi: 'delete',
    entitas: 'form_versions',
    entitasId: formVersionId,
    sesudah: {
      ...hasil,
      formVersionId,
    },
  })

  return hasil
}
