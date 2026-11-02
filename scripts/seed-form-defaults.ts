/**
 * Seeder Form Builder v2.
 *
 * Dua form bawaan dibuat lewat `forms.kode`, bukan `forms.nama`, supaya seeder
 * bisa menemukan form yang sama pada penjalanan berikutnya meskipun admin
 * sudah mengganti nama formnya.
 *
 * ATURAN PENTING: seeder ini tidak pernah menimpa definisi form yang sudah
 * ada. Kalau `forms.kode` sudah ada, seeder berhenti untuk form itu dan
 * mencetak laporan. Admin yang mengedit field lewat Form Builder tidak boleh
 * kehilangan-editannya hanya karena `pnpm db:seed` dijalankan ulang.
 *
 * SATU-SATUNYA PENGECUALIAN: FORM KOSONG TOTAL
 * --------------------------------------------
 * Form yang tidak punya satu pun section atau field di versi mana pun justru
 * DIISI definisi bawaannya. Keadaan itu bukan hasil edit admin — tidak ada yang
 * bisa diedit di form tanpa field — melainkan sisa database yang tabel
 * definisinya dibangun ulang dalam keadaan kosong oleh migrasi manual (lihat
 * drizzle/manual/20261008_lengkapi-form-builder.sql). Tanpa pengecualian ini,
 * pesan "Jalankan `pnpm db:seed`" yang dikirim aplikasi ketika definisi hilang
 * justru tidak bisa dipenuhi seeder-nya sendiri: `forms` masih ada, seeder
 * berhenti, dan Laporan/Kegiatan/Form Builder tetap rusak.
 *
 * Definisi field Form Kunjungan Rumah tidak diketik tangan di sini. Ia
 * diturunkan dari `createDefaultKunjunganRumahTemplates()`, konstanta lokal
 * yang sama dengan fallback dipakai `useKunjunganRumahTemplateDb`. Sebalik
 * `templateFromRows()` membangunkannya lagi dari baris database. Menyalin
 * daftar field ke sini secara manual pasti akan menyimpang dari template
 * lokal setelah salah satu sisipan berubah.
 */
import { and, desc, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/server/db.server'
import {
  formVersions,
  forms,
  surveyEntries,
  surveys,
} from '@/lib/schema/schema'
import type { FormDefinition } from '@/lib/form-builder/form-schema'
import {
  createDefaultKunjunganRumahTemplates,
  KUNJUNGAN_RUMAH_TEMPLATE_VERSION,
} from '../src/lib/kunjungan-rumah/template/kunjungan-rumah-templates.ts'
import type { KunjunganRumahTemplateField } from '../src/lib/kunjungan-rumah/template/kunjungan-rumah-templates.ts'
import { SASARAN_KEYS } from '../src/lib/kunjungan-rumah/template/kunjungan-rumah-form.ts'
import {
  namaFieldUnik,
  FORM_KUNJUNGAN_RUMAH,
} from '../src/lib/kunjungan-rumah/template/template-from-rows.ts'
import { JENIS_KEGIATAN, KODE_FORM_BAWAAN } from '@/lib/constants'

/**
 * Di-re-export dari `src/lib/constants.ts` supaya seeder dan kode runtime memakai
 * satu sumber. Kalau kodenya hanya hidup di `scripts/`, reader di `src/` akan
 *reachable lewat import yang arahnya terbalik.
 */
export const KODE_FORM = KODE_FORM_BAWAAN

/**
 * Nama bawaan form kunjungan rumah diambil dari satu konstanta di `src/` supaya
 * tidak ada dua tempat yang bisa menyimpang. Nama ini hanya nilai awal —
 * pembacaan runtime memakai `forms.kode`, bukan `forms.nama`.
 */
const NAMA_FORM = {
  kegiatan: 'Form Kegiatan Pemberdayaan',
  kunjunganRumah: FORM_KUNJUNGAN_RUMAH,
} as const

type JenisFieldDb =
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'date'
  | 'time'
  | 'image'
  | 'file'
  | 'group'

/** Bucket layout panel sasaran disimpan sebagai prefix pada `option_source_key`. */
function kunciBucket(bucket: string | null): string | null {
  return bucket === null ? null : `bucket=${bucket}`
}

/** `section` UI sudah persis nama section di database, jadi tidak perlu dipetakan. */
interface BarisField {
  nama: string
  label: string
  tipe: JenisFieldDb
  wajib: boolean
  urutan: number
  /** Tipe sumber opsi dinamis (mis. "users"). null = opsi statis dari `options`. */
  optionSourceType: string | null
  optionSourceKey: string | null
  options: string[]
  jumlahKolom: number | null
  placeholder?: string | null
  layoutGroup?: string | null
}

interface BarisSection {
  nama: string
  label?: string
  urutan: number
  /** Peran section bagi renderer; null = disimpulkan dari nama saat dibaca. */
  sectionKind?: string | null
  layoutGroups?: { key: string; label: string; order: number }[]
  fields: BarisField[]
}

/** Field yang menyimpan seluruh payload legacy untuk Form Kunjungan Rumah. */
export const FIELD_RECORD_LEGACY = 'record_legacy'

/**
 * Bangun section + field Form Kunjungan Rumah dari template lokal.
 *
 * Urutan section mengikuti `t.sections`, lalu section sasaran disisipkan pada
 * `sasaranOrder` supaya kartu Form Sasaran tetap berada di tengah. Section
 * bawaan membawa `sectionKind` eksplisit: renderer boleh menyimpulkannya dari
 * nama, tapi metadata ini yang membuat section generik baru tidak perlu
 * ditafsirkan ulang dari namanya.
 *
 * Bucket diambil dari `field.section` (`sasaran:identitas` → `identitas`),
 * karena `templateFromRows()` memetakannya kembali dengan BUCKET_TO_SECTION.
 */
function sectionsKunjunganRumah(): BarisSection[] {
  const t = createDefaultKunjunganRumahTemplates()
  const sections: BarisSection[] = []

  const pushField = (
    list: BarisField[],
    f: KunjunganRumahTemplateField,
    sectionNama: string,
    bucket: string | null,
  ): void => {
    list.push({
      nama: namaFieldUnik(sectionNama, f.id),
      label: f.label,
      tipe: f.kind,
      wajib: f.required,
      urutan: f.order,
      optionSourceType: null,
      optionSourceKey: kunciBucket(bucket),
      options: f.options ?? [],
      jumlahKolom: f.columns ?? null,
      placeholder: f.placeholder ?? null,
      layoutGroup: f.layoutGroup ?? null,
    })
  }

  let urutan = 0

  const pushSasaran = (): void => {
    for (const key of SASARAN_KEYS) {
      const def = t.sasaran[key]
      const list: BarisField[] = []
      for (const f of def.fields) {
        const bucket = f.section.startsWith('sasaran:')
          ? f.section.slice('sasaran:'.length)
          : null
        if (bucket === null) {
          throw new Error(
            `Field sasaran "${f.id}" tidak punya bucket yang bisa dibaca; section-nya "${f.section}".`,
          )
        }
        pushField(list, f, key, bucket)
      }
      sections.push({
        nama: key,
        label: def.label,
        urutan: urutan++,
        sectionKind: 'sasaran',
        layoutGroups: def.layoutGroups,
        fields: list,
      })
    }
  }

  const pushSection = (section: (typeof t.sections)[number]): void => {
    const list: BarisField[] = []
    for (const f of section.fields) pushField(list, f, section.name, null)
    sections.push({
      nama: section.name,
      label: section.label,
      urutan: urutan++,
      sectionKind: section.kind,
      layoutGroups: section.layoutGroups,
      fields: list,
    })
  }

  const sectionsTerurut = [...t.sections].sort((a, b) => a.order - b.order)
  for (const section of sectionsTerurut) {
    if (section.order < t.sasaranOrder) pushSection(section)
  }
  pushSasaran()
  for (const section of sectionsTerurut) {
    if (section.order >= t.sasaranOrder) pushSection(section)
  }

  // Field `record_legacy` tidak ada di template lokal: ia adalah tempat
  // penyimpanan payload, bukan pertanyaan yang dilihat petugas. Ditambahkan di
  // section terakhir supaya tidak menggeser urutan field yang lain.
  sections.push({
    nama: 'penyimpanan',
    label: 'Penyimpanan',
    urutan: urutan++,
    sectionKind: 'penyimpanan',
    layoutGroups: [],
    fields: [
      {
        nama: namaFieldUnik('penyimpanan', FIELD_RECORD_LEGACY),
        label: 'Data kunjungan rumah (penyimpanan)',
        tipe: 'group',
        wajib: false,
        urutan: 0,
        optionSourceType: null,
        optionSourceKey: null,
        options: [],
        jumlahKolom: null,
      },
    ],
  })

  return sections
}

/**
 * Form Kegiatan Pemberdayaan.
 *
 * Dipisah dari Form Kunjungan Rumah karena submission kegiatan tidak menunjuk
 * warga (`forms.subjekWargaWajib = false`). Field `peserta` berupa `group`
 * karena daftar peserta berulang dan tidak muat di satu select.
 */
function sectionsKegiatan(): BarisSection[] {
  // Nama field di sini tetap dibungkus `namaFieldUnik` supaya kedua form
  // memakai aturan nama yang sama persis, walau id kegiatan memang unik.
  const field = (
    sectionNama: string,
    nama: string,
    label: string,
    tipe: JenisFieldDb,
    urutan: number,
    extra: Partial<BarisField> = {},
  ): BarisField => ({
    nama: namaFieldUnik(sectionNama, nama),
    label,
    tipe,
    wajib: false,
    urutan,
    optionSourceType: null,
    optionSourceKey: null,
    options: [],
    jumlahKolom: null,
    ...extra,
  })

  return [
    {
      nama: 'identitas',
      urutan: 0,
      fields: [
        field('identitas', 'nama', 'Nama kegiatan', 'text', 0, { wajib: true }),
        field('identitas', 'jenis', 'Jenis kegiatan', 'select', 1, {
          wajib: true,
          options: [...JENIS_KEGIATAN],
        }),
        field('identitas', 'tgl', 'Tanggal', 'date', 2, { wajib: true }),
        field('identitas', 'jam', 'Jam', 'time', 3),
        field('identitas', 'lokasi', 'Lokasi', 'text', 4, { wajib: true }),
        field('identitas', 'kel', 'Kelurahan', 'text', 5, { wajib: true }),
        // Petugas dipilih manual dari registry `users`, bukan diambil dari sesi
        // login. Alasannya login masih pakai satu PIN global dengan role
        // hard-coded, jadi tidak ada `users.id` yang bisa dipercaya sebagai
        // "siapa yang sedang login".
        //
        // Opsi field ini TIDAK ditulis ke `form_field_options`. Oksinya diambil
        // saat render dan saat validasi dari tabel `users` lewat
        // `optionSourceType`/`optionSourceKey`, jadi menambah petugas di
        // /kelola langsung mengubah pilihan di form tanpa seeding ulang.
        field('identitas', 'petugas', 'Petugas', 'select', 6, {
          wajib: true,
          optionSourceType: 'users',
          optionSourceKey: 'petugas',
        }),
        field('identitas', 'target', 'Target', 'text', 7),
        field('identitas', 'posy', 'Posyandu', 'text', 8),
        field('identitas', 'deskripsi', 'Deskripsi', 'textarea', 9),
      ],
    },
    {
      nama: 'peserta',
      urutan: 1,
      fields: [
        field('peserta', 'peserta', 'Daftar peserta', 'group', 0, {
          jumlahKolom: 3,
        }),
        field('peserta', 'hadir', 'Jumlah hadir', 'number', 1),
        field('peserta', 'total', 'Jumlah peserta', 'number', 2),
      ],
    },
    {
      nama: 'dokumentasi',
      urutan: 2,
      fields: [field('dokumentasi', 'foto', 'Foto kegiatan', 'image', 0)],
    },
  ]
}

export interface LaporanSeed {
  kode: string
  /**
   * `diperbaiki` berarti formnya sudah ada dan yang hilang hanya definisinya,
   * jadi baris `forms` (nama, deskripsi) tidak disentuh. Dipisah dari `dibuat`
   * supaya laporan `pnpm db:seed` tidak menimbulkan kesan editan admin ikut
   * tertimpa.
   */
  status: 'dibuat' | 'diperbaiki' | 'dilewati'
  /** Nomor versi yang diisi definisinya; `null` kalau tidak ada yang ditulis. */
  versi: number | null
}

/**
 * Apakah form ini sudah punya definisi (section atau field) di salah satu
 * versinya?
 *
 * Ini pemisah antara "belum pernah di-seed" dan "sudah ada isinya". Selama ada
 * satu pun section atau field, definisi dianggap milik admin dan seeder tidak
 * boleh menyentuhnya — walau isinya tidak lengkap sekalipun, mungkin memang
 * sedang disunting di Form Builder.
 */
async function adaDefinisiForm(formId: number): Promise<boolean> {
  const versions = await db
    .select({ schema: formVersions.schema })
    .from(formVersions)
    .where(eq(formVersions.formId, formId))
  return versions.some(
    (version) =>
      Array.isArray(version.schema.sections) &&
      version.schema.sections.length > 0,
  )
}

/**
 * Buat satu form beserta versi published pertama, atau isi ulang definisi yang
 * hilang.
 *
 * Kalau `forms.kode` sudah ada DAN formnya sudah punya definisi, fungsi ini
 * mengembalikan `status: 'dilewati'` tanpa menyentuh satu baris pun. Itu yang
 * menjaga editan admin tetap utuh. Form yang sudah ada tapi kosong total justru
 * diperbaiki; lihat catatan "SATU-SATUNYA PENGECUALIAN" di atas file ini.
 */
async function seedForm(params: {
  kode: string
  nama: string
  deskripsi: string
  subjekWargaWajib: boolean
  /** Angka di kolom `form_versions.version`; lihat catatan di dalam fungsi. */
  nomorVersi: number
  sections: BarisSection[]
}): Promise<LaporanSeed> {
  const [existing] = await db
    .select({ id: forms.id })
    .from(forms)
    .where(eq(forms.kode, params.kode))
    .limit(1)
  if (existing && (await adaDefinisiForm(existing.id))) {
    return { kode: params.kode, status: 'dilewati', versi: null }
  }

  // Semua penulisan satu form ditulis dalam satu transaksi. Insert per baris di luar
  // transaksi berarti satu round trip ke server Postgres per field, dan Form
  // Kunjungan Rumah punya ~360 field — dari mesin lokal lewat pooler Supabase
  // itu berjam-jam. Dengan satu transaksi, ratusan baris selesai dalam
  // hitungan detik. Kalau ada field yang gagal, tidak ada form setengah jadi.
  return db.transaction(async (tx) => {
    const now = new Date()
    let formId: number
    if (existing) {
      // Jalur perbaikan: baris `forms` sudah ada dan dipakai ulang apa adanya,
      // jadi `nama`/`deskripsi` yang mungkin sudah diedit admin tidak tertimpa.
      formId = existing.id
    } else {
      const [form] = await tx
        .insert(forms)
        .values({
          nama: params.nama,
          kode: params.kode,
          deskripsi: params.deskripsi,
          subjekWargaWajib: params.subjekWargaWajib,
        })
        .returning()
      if (!form) throw new Error(`Gagal membuat form "${params.nama}"`)
      formId = form.id
    }

    // Nomor versi BUKAN selalu 1. `form_versions.version` dibaca
    // `templateFromRows()` sebagai penanda "definisi di DB milik template yang
    // sedang berjalan", dan nilainya harus sama dengan
    // KUNJUNGAN_RUMAH_TEMPLATE_VERSION. Kalau di-seed dengan angka 1, seluruh
    // form kunjungan rumah gagal dibuka dengan error versi tidak cocok.
    //
    // Yang diisi definisinya adalah versi yang dibaca runtime, yaitu yang
    // berstatus `published`. Saat memperbaiki, versi itu biasanya sudah ada dan
    // tinggal diisi; membuat versi kedua yang tayang justru membuat runtime
    // menebak-nebak.
    let [versi] = await tx
      .select({
        id: formVersions.id,
        version: formVersions.version,
        status: formVersions.status,
      })
      .from(formVersions)
      .where(
        and(
          eq(formVersions.formId, formId),
          eq(formVersions.status, 'published'),
        ),
      )
      .orderBy(desc(formVersions.version))
      .limit(1)

    if (!versi) {
      // Tidak ada versi yang tayang. Pakai dulu versi bernomor `nomorVersi`
      // kalau sudah ada — nomor itu yang dipakai seeder pertama kali, jadi
      // memakainya lagi tidak menabrak unique (formId, version) — baru terbitkan.
      const [terpakai] = await tx
        .select({
          id: formVersions.id,
          version: formVersions.version,
          status: formVersions.status,
        })
        .from(formVersions)
        .where(
          and(
            eq(formVersions.formId, formId),
            eq(formVersions.version, params.nomorVersi),
          ),
        )
        .limit(1)
      versi = terpakai
    }

    const legacyEntry =
      params.kode === KODE_FORM.kunjunganRumah && versi
        ? await tx
            .select({ fieldId: surveyEntries.fieldId })
            .from(surveyEntries)
            .innerJoin(surveys, eq(surveys.id, surveyEntries.surveyId))
            .where(
              and(
                eq(surveys.formVersionId, versi.id),
                sql`${surveyEntries.value} ? 'schemaVersion'`,
              ),
            )
            .limit(1)
        : []
    const legacyRecordId = legacyEntry[0]?.fieldId
    const schema: FormDefinition = {
      version: versi?.version ?? params.nomorVersi,
      sections: params.sections.map((section) => ({
        id: crypto.randomUUID(),
        name: section.nama,
        label: section.label ?? section.nama,
        description: null,
        order: section.urutan,
        active: true,
        sectionKind: section.sectionKind ?? null,
        layoutGroups: section.layoutGroups ?? [],
        visibilityRules: [],
        fields: section.fields.map((field) => ({
          id:
            field.nama === namaFieldUnik('penyimpanan', FIELD_RECORD_LEGACY) &&
            legacyRecordId
              ? legacyRecordId
              : crypto.randomUUID(),
          name: field.nama,
          label: field.label,
          type: field.tipe,
          required: field.wajib,
          active: true,
          order: field.urutan,
          description: null,
          placeholder: field.placeholder ?? null,
          columns: field.jumlahKolom,
          layoutGroup: field.layoutGroup ?? null,
          optionSourceType: field.optionSourceType,
          optionSourceKey: field.optionSourceKey,
          options: field.options.map((value, order) => ({
            id: crypto.randomUUID(),
            value,
            label: value,
            order,
            active: true,
          })),
          autofill: [],
          visibilityRules: [],
        })),
      })),
    }

    if (versi) {
      // Status diangkat ke `published` hanya bila tidak ada satupun yang tayang,
      // jadi tidak mungkin terjadi dua versi published sekaligus.
      if (versi.status !== 'published') {
        await tx
          .update(formVersions)
          .set({ status: 'published', publishedAt: now })
          .where(eq(formVersions.id, versi.id))
      }
      await tx
        .update(formVersions)
        .set({ schema, updatedAt: now })
        .where(eq(formVersions.id, versi.id))
    } else {
      // Status tetap langsung `published`, bukan `draft`: form bawaan harus bisa
      // dipakai petugas tanpa langkah publish manual. `publishedAt` wajib terisi
      // karena check `form_versions_published_at_check` menagihnya.
      const [baru] = await tx
        .insert(formVersions)
        .values({
          formId,
          version: params.nomorVersi,
          status: 'published',
          publishedAt: now,
          schema,
        })
        .returning()
      if (!baru)
        throw new Error(`Gagal membuat versi untuk form "${params.nama}"`)
      versi = baru
    }

    return {
      kode: params.kode,
      status: existing ? 'diperbaiki' : 'dibuat',
      versi: versi.version,
    }
  })
}

export async function seedFormDefaults(): Promise<LaporanSeed[]> {
  // Berurutan, bukan paralel: masing-masing adalah satu transaksi ratusan
  // baris yang memakai pool koneksi yang sama.
  return [
    await seedForm({
      kode: KODE_FORM.kegiatan,
      nama: NAMA_FORM.kegiatan,
      deskripsi:
        'Catatan kegiatan pemberdayaan. Tidak menunjuk warga per-submission; daftar peserta disimpan di field peserta.',
      subjekWargaWajib: false,
      nomorVersi: 1,
      sections: sectionsKegiatan(),
    }),
    await seedForm({
      kode: KODE_FORM.kunjunganRumah,
      nama: NAMA_FORM.kunjunganRumah,
      deskripsi:
        'Checklist kunjungan rumah. Setiap submission wajib menunjuk satu warga.',
      subjekWargaWajib: true,
      nomorVersi: KUNJUNGAN_RUMAH_TEMPLATE_VERSION,
      sections: sectionsKunjunganRumah(),
    }),
  ]
}
