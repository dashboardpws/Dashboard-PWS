/**
 * Adapter kegiatan Pemberdayaan ke generic submission v2.
 *
 *-INI ADAPTER, BUKAN PENGGANTI FORM
 * ---------------------------------
 * Form Kunjungan Rumah memakai `record_legacy`: satu baris `survey_entries` berisi
 * seluruh payload dalam JSONB. Kegiatan memakai bentuk yang berlawanan: satu
 * `survey_entries` per field, supaya rekap per-field bisa dibangun tanpa membaca
 * ulang JSON.
 *
 * Alasan bentuknya berbeda adalah bentuk UI. Layar `/kunjungan-rumah` sudah
 * dibangun dari `useKunjunganRumahTemplateDb` yang membaca definisi field dari
 * database, jadi ia benar-benar generic. Layar `/kegiatan` masih form khusus
 * dengan urutan field yang tetap (`use-kegiatan.ts`), jadi memetakannya ke
 * `survey_entries` per-field adalah langkah di antara keduanya, bukan langkah
 * terakhir. Kalau nanti `/kegiatan` juga jadi generic, bagian mapping di bawah
 * hilang dan sisanya (petugas, tanggal, entry) tetap terpakai.
 *
 * PETUGAS
 * -------
 * `petugas` disimpan sebagai `users.id` di `survey_entries` DAN di
 * `surveys.petugasId`. Keduanya tidak sengaja diduplikasi:
 *   - `surveys.petugasId` adalah kolom yang di-index untuk filter "survey petugas
 *     X bulan ini", jadi nilainya harus berupa UUID.
 *   - `survey_entries` menyimpan apa yang benar-benar dipilih petugas di form,
 *     supaya field yang tampil di form dan isi `survey_entries` tidak bisa beda.
 * Ketidakcocokan antara keduanya dicek `pastikanPetugasValid()`.
 */
import { and, desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/server/db.server'
import {
  formVersions,
  forms,
  surveys,
  surveyEntries,
  users,
} from '@/lib/schema/schema'
import { pastikanPetugasValid } from '@/lib/server/petugas/user-registry.server'
import { KODE_FORM_BAWAAN } from '@/lib/constants'
import { parseFormDefinition } from '@/lib/form-builder/form-schema'

/** `forms.kode` untuk form kegiatan. Sama dengan yang dipakai seeder. */
const KODE_KEGIATAN = KODE_FORM_BAWAAN.kegiatan

/**
 * Peta nama field UI (key di `KegiatanFieldState`) ke `form_fields.nama`.
 *
 * Nama field di database berawalan section karena `form_fields.nama` unik per
 * versi form, sedangkan template lama memakai ulang nama seperti `nama` di
 * beberapa section. Prefix section inilah yang ditambahkan seeder lewat
 * `namaFieldUnik()`.
 */
const PETA_FIELD: Readonly<Record<string, string>> = {
  nama: 'identitas::nama',
  jenis: 'identitas::jenis',
  tgl: 'identitas::tgl',
  jam: 'identitas::jam',
  lokasi: 'identitas::lokasi',
  kel: 'identitas::kel',
  petugas: 'identitas::petugas',
  target: 'identitas::target',
  posy: 'identitas::posy',
  deskripsi: 'identitas::deskripsi',
  peserta: 'peserta::peserta',
  hadir: 'peserta::hadir',
  total: 'peserta::total',
  foto: 'dokumentasi::foto',
}

type JsonRecord = Record<string, unknown>

function asJsonRecord(v: unknown): JsonRecord {
  if (!v || typeof v !== 'object' || Array.isArray(v)) {
    throw new Error('Data kegiatan tidak valid.')
  }
  return v as JsonRecord
}

function teks(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

function angka(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

/** Field wajib yang kosong harus ditolak sebelum menyentuh database. */
const FIELD_WAJIB = [
  'nama',
  'jenis',
  'tgl',
  'lokasi',
  'kel',
  'petugas',
] as const

interface VersiKegiatan {
  formVersionId: string
  fieldIdByNama: Map<string, string>
}

/**
 * Cari form kegiatan lewat `forms.kode`, bukan `forms.nama`.
 *
 * `nama` boleh diubah admin, sedangkan `kode` tidak. Kalau pencarian lewat nama,
 * semua kegiatan akan gagal dibaca begitu admin mengganti nama formnya.
 *
 * Yang diambil adalah versi terbaru yang berstatus `published`, bukan versi
 * dengan nomor terkecil. Begitu admin bisa menerbitkan versi baru, nomor versi
 * tidak lagi menentukan versi yang tayang: draft dan archived sengaja tidak
 * boleh jadi sumber bacaan, karena field-nya bisa berbeda dari yang dipakai
 * petugas di lapangan. Database juga menjaga paling banyak satu versi
 * `published` per form, jadi hasil query ini selalu versi yang benar-benar
 * hidup.
 */
async function cariVersiKegiatan(): Promise<VersiKegiatan> {
  const [form] = await db
    .select({ id: forms.id })
    .from(forms)
    .where(eq(forms.kode, KODE_KEGIATAN))
    .limit(1)
  if (!form) {
    throw new Error(
      `Form kegiatan (kode "${KODE_KEGIATAN}") belum ada di database. Jalankan \`pnpm db:seed\`.`,
    )
  }

  const [versi] = await db
    .select({
      id: formVersions.id,
      version: formVersions.version,
      schema: formVersions.schema,
    })
    .from(formVersions)
    .where(
      and(
        eq(formVersions.formId, form.id),
        eq(formVersions.status, 'published'),
      ),
    )
    .orderBy(desc(formVersions.version))
    .limit(1)
  if (!versi) {
    throw new Error(
      `Form kegiatan belum punya versi yang tayang. Jalankan \`pnpm db:seed\`.`,
    )
  }

  const baris = parseFormDefinition(versi.schema).sections.flatMap((section) =>
    section.fields.map((field) => ({ id: field.id, nama: field.name })),
  )
  if (baris.length === 0) {
    throw new Error(
      `Versi ${versi.version} dari form kegiatan tidak punya field.`,
    )
  }

  return {
    formVersionId: versi.id,
    fieldIdByNama: new Map(baris.map((b) => [b.nama, b.id])),
  }
}

/** Field yang wajib ada di DB; kalau hilang berarti seeder perlu dijalankan ulang. */
function wajibAda(v: VersiKegiatan, namaField: string): string {
  const id = v.fieldIdByNama.get(namaField)
  if (!id) {
    throw new Error(
      `Field "${namaField}" tidak ada di versi form kegiatan ini. Jalankan \`pnpm db:seed\`.`,
    )
  }
  return id
}

export interface PesertaKegiatan {
  nama: string
  kel: string
  hadir: boolean
}

export interface KegiatanSimpan {
  nama: string
  jenis: string
  /** `users.id` untuk petugas pencatat. */
  petugas: string
  tgl: string
  jam: string
  lokasi: string
  kel: string
  target: string
  posy: string
  deskripsi: string
  hadir: number
  total: number
  /** Jumlah foto yang terlampir. Isinya sudah berupa caption, bukan file. */
  foto: number
  peserta: PesertaKegiatan[]
}

export interface KegiatanBaca extends KegiatanSimpan {
  id: string
  tanggal: string
  /**
   * `users.id` petugas pencatat, sama dengan isi `surveys.petugasId`.
   *
   * Dipisah dari `petugas` yang berisi NAMA, supaya tidak ada kebetulan
   * `petugas` dianggap UUID. Kalau yang dibutuhkan untuk filter atau relasi,
   * pakai yang ini; kalau untuk ditampilkan, pakai `petugas`.
   */
  petugasId: string
}

/**
 * Simpan satu kegiatan.
 *
 * Validasi yang dikerjakan di sini, sebelum transaksi dibuka:
 * 1. Field wajib tidak kosong.
 * 2. `petugas` benar-benar `users.id` milik akun aktif dan bukan admin.
 * 3. Tanggal bisa dibaca sebagai tanggal ISO.
 *
 * Semua row `surveys` + `survey_entries` ditulis dalam satu transaksi, jadi
 * submission setengah jadi tidak mungkin.
 */
export async function simpanKegiatan(payload: unknown): Promise<KegiatanBaca> {
  const rec = asJsonRecord(payload)

  for (const k of FIELD_WAJIB) {
    if (teks(rec[k]).trim() === '') {
      throw new Error(`Field ${k} wajib diisi.`)
    }
  }

  // Petugas dipilih manual, jadi nilainya adalah `users.id`. Keabsahan akun
  // dicek di sini supaya pesan errornya bisa dibaca petugas, bukan error FK.
  //
  // Yang disimpan ke `surveys.petugasId` adalah `id`, BUKAN `nama`. Kolomnya
  // bertipe uuid, jadi nama akan ditolak Postgres dengan pesan yang tidak
  // berguna untuk petugas.
  const petugas = await pastikanPetugasValid(teks(rec.petugas))

  const tanggal = teks(rec.tgl).trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
    throw new Error('Tanggal kegiatan tidak valid. Gunakan format YYYY-MM-DD.')
  }

  const v = await cariVersiKegiatan()

  // Peserta dinormalkan ke array objek. Field `peserta::peserta` bertipe group,
  // jadi validator grup akan menolak bentuk lain.
  const peserta: PesertaKegiatan[] = Array.isArray(rec.peserta)
    ? (rec.peserta as unknown[]).flatMap((p) => {
        const o = asJsonRecord(p)
        return [
          { nama: teks(o.nama), kel: teks(o.kel), hadir: o.hadir === true },
        ]
      })
    : []

  const answers: Array<{ fieldId: string; value: unknown }> = [
    { fieldId: wajibAda(v, PETA_FIELD.nama!), value: teks(rec.nama).trim() },
    { fieldId: wajibAda(v, PETA_FIELD.jenis!), value: teks(rec.jenis) },
    { fieldId: wajibAda(v, PETA_FIELD.tgl!), value: tanggal },
    { fieldId: wajibAda(v, PETA_FIELD.jam!), value: teks(rec.jam) },
    {
      fieldId: wajibAda(v, PETA_FIELD.lokasi!),
      value: teks(rec.lokasi).trim(),
    },
    { fieldId: wajibAda(v, PETA_FIELD.kel!), value: teks(rec.kel).trim() },
    { fieldId: wajibAda(v, PETA_FIELD.petugas!), value: petugas.id },
    { fieldId: wajibAda(v, PETA_FIELD.target!), value: teks(rec.target) },
    { fieldId: wajibAda(v, PETA_FIELD.posy!), value: teks(rec.posy) },
    { fieldId: wajibAda(v, PETA_FIELD.deskripsi!), value: teks(rec.deskripsi) },
    { fieldId: wajibAda(v, PETA_FIELD.hadir!), value: angka(rec.hadir) },
    { fieldId: wajibAda(v, PETA_FIELD.total!), value: angka(rec.total) },
    { fieldId: wajibAda(v, PETA_FIELD.foto!), value: angka(rec.foto) },
    { fieldId: wajibAda(v, PETA_FIELD.peserta!), value: peserta },
  ]

  const id = crypto.randomUUID()

  await db.transaction(async (tx) => {
    await tx.insert(surveys).values({
      id,
      formVersionId: v.formVersionId,
      // Form kegiatan tidak punya warga tetap per-submission; lihat
      // `forms.subjekWargaWajib` dan komentar di `surveys.wargaNik`.
      wargaNik: null,
      petugasId: petugas.id,
      tanggal,
    })
    await tx.insert(surveyEntries).values(
      answers.map((a) => ({
        surveyId: id,
        fieldId: a.fieldId,
        value: a.value,
      })),
    )
  })

  return {
    id,
    tanggal,
    nama: teks(rec.nama).trim(),
    jenis: teks(rec.jenis),
    petugas: petugas.nama,
    petugasId: petugas.id,
    tgl: tanggal,
    jam: teks(rec.jam),
    lokasi: teks(rec.lokasi).trim(),
    kel: teks(rec.kel).trim(),
    target: teks(rec.target),
    posy: teks(rec.posy),
    deskripsi: teks(rec.deskripsi),
    hadir: angka(rec.hadir),
    total: angka(rec.total),
    foto: angka(rec.foto),
    peserta,
  }
}

/**
 * Baca semua kegiatan untuk form kegiatan, diurutkan dari yang terbaru.
 *
 * Officer dikembalikan sebagai NAMA, bukan UUID, karena semua pemakainya
 * (`/kegiatan` dan `/laporan`) menampilkannya ke petugas. UUID-nya ada di
 * `surveys.petugasId` untuk yang butuh memfilter.
 */
export async function listKegiatan(): Promise<KegiatanBaca[]> {
  const v = await cariVersiKegiatan()
  const kebalikan = new Map<string, string>()
  for (const [nama, id] of v.fieldIdByNama) kebalikan.set(id, nama)

  const baris = await db
    .select({
      id: surveys.id,
      tanggal: surveys.tanggal,
      petugasId: surveys.petugasId,
      fieldId: surveyEntries.fieldId,
      value: surveyEntries.value,
    })
    .from(surveys)
    .innerJoin(surveyEntries, eq(surveyEntries.surveyId, surveys.id))
    .where(eq(surveys.formVersionId, v.formVersionId))
    .orderBy(surveys.tanggal)

  // Petugas bisa jadi sudah dinonaktifkan, tapi nama di
  // `users` tetap ada untuk ditampilkan.
  const petugasIds = [...new Set(baris.map((b) => b.petugasId))]
  const namaPetugas = new Map<string, string>()
  if (petugasIds.length > 0) {
    const usersRows = await db
      .select({ id: users.id, nama: users.nama })
      .from(users)
      .where(inArray(users.id, petugasIds))
    for (const u of usersRows) namaPetugas.set(u.id, u.nama)
  }

  const perSurvey = new Map<string, KegiatanBaca>()
  for (const b of baris) {
    let row = perSurvey.get(b.id)
    if (!row) {
      row = {
        id: b.id,
        tanggal: b.tanggal,
        nama: '',
        jenis: '',
        petugas: namaPetugas.get(b.petugasId) ?? '—',
        petugasId: b.petugasId,
        tgl: b.tanggal,
        jam: '',
        lokasi: '',
        kel: '',
        target: '',
        posy: '',
        deskripsi: '',
        hadir: 0,
        total: 0,
        foto: 0,
        peserta: [],
      }
      perSurvey.set(b.id, row)
    }

    const namaField = kebalikan.get(b.fieldId)
    if (!namaField) continue
    const nilai = b.value

    switch (namaField) {
      case PETA_FIELD.nama:
        row.nama = teks(nilai)
        break
      case PETA_FIELD.jenis:
        row.jenis = teks(nilai)
        break
      case PETA_FIELD.tgl:
        row.tgl = teks(nilai, b.tanggal)
        break
      case PETA_FIELD.jam:
        row.jam = teks(nilai)
        break
      case PETA_FIELD.lokasi:
        row.lokasi = teks(nilai)
        break
      case PETA_FIELD.kel:
        row.kel = teks(nilai)
        break
      case PETA_FIELD.target:
        row.target = teks(nilai)
        break
      case PETA_FIELD.posy:
        row.posy = teks(nilai)
        break
      case PETA_FIELD.deskripsi:
        row.deskripsi = teks(nilai)
        break
      case PETA_FIELD.hadir:
        row.hadir = angka(nilai)
        break
      case PETA_FIELD.total:
        row.total = angka(nilai)
        break
      case PETA_FIELD.foto:
        row.foto = angka(nilai)
        break
      case PETA_FIELD.peserta:
        row.peserta = Array.isArray(nilai)
          ? (nilai as unknown[]).flatMap((p) => {
              const o = asJsonRecord(p)
              return [
                {
                  nama: teks(o.nama),
                  kel: teks(o.kel),
                  hadir: o.hadir === true,
                },
              ]
            })
          : []
        break
      default:
        break
    }
  }

  return [...perSurvey.values()]
}
