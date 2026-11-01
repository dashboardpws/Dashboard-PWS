/**
 * Riwayat submit survei untuk tab Riwayat di laporan: isian form, jawaban per submit,
 * dan ringkasan jumlahnya. Sumbernya tabel `surveys` dan `survey_entries`.
 */

import { db } from './db.server'
import { eq, sql } from 'drizzle-orm'
import { formVersions, surveyEntries, surveys } from '@/lib/schema/schema'
import { parseFormDefinition } from '@/lib/form-builder/form-schema'

/** Baris isian form yang dipakai dashboard, laporan, dan detail sasaran. */
export interface BarisIsianForm {
  id: string
  tanggal: string
  /** NULL kalau form-nya tidak menunjuk warga per-submission (mis. kegiatan). */
  nik: string | null
  nama: string
  kelurahan: string
  petugas: string
  /** Nama form dari `forms`, bukan label hardcoded — ini yang membuat record
   *  form buatan Form Builder tidak lagi tampil sebagai "kunjungan rumah". */
  formNama: string
  formKode: string | null
  formVersion: number
}

/**
 * Isian form dari semua form, untuk dashboard dan laporan.
 *
 * JOIN, bukan tiga query lalu dicocokkan di JS. Versi lama membaca SELURUH
 * `data_warga` dan SELURUH `users` tanpa `.limit()`, lalu memfilter/memetakan
 * di memori — jadi saat `data_warga` terisi banyak warga (form Kunjungan Rumah
 * menyimpan warga ke sana), satu halaman laporan menarik seluruh tabel cuma untuk
 * menampilkan 50–500 baris. Index yang dipakai: `surveys_tanggal_idx` untuk
 * `ORDER BY ... DESC LIMIT`, `data_warga_pkey` untuk lookup NIK per baris.
 *
 * `tanggal` dikirim lewat `to_char` supaya tipenya string `YYYY-MM-DD`. Kolomnya
 * bertipe `date`, dan driver postgres mengembalikan objek Date untuk tipe itu,
 * sedangkan pemanggil (`SurveyRow`) dan pembanding rentang tanggal di UI
 * (`laporan.tsx`: `r.tanggal >= dari`) memperlakukan string — tanpa `to_char`,
 * perbandingan string itu diam-diam jadi tidak berlaku.
 *
 * FILTER FORM TIDAK ADA DI SINI, dan itu disengaja. Tabel `surveys` tidak punya
 * kolom penanda form; identitas form hanya `formVersionId`, jadi nama form
 * diambil lewat join `form_versions → forms`. Query lama menyaring
 * `wargaNik IS NOT NULL` lalu UI melabeli hasilnya "Kunjungan Rumah" — itu
 * membuat submit form buatan Form Builder ikut terhitung sebagai kunjungan.
 * Sekarang semua baris ikut, dan setiap baris membawa `formNama` untuk
 * dilabelikan sesuai form asalnya. `nik` karena itu jadi nullable: form yang tidak
 * mewajibkan warga (kegiatan, form generic) tetap tampil, hanya tanpa kolom warga.
 */
export async function querySurveysWithWarga(
  limit = 500,
): Promise<BarisIsianForm[]> {
  const rows = await db.execute(sql`
        SELECT
            s.id                                   AS "id",
            to_char(s."tanggal", 'YYYY-MM-DD')     AS "tanggal",
            s."wargaNik"                           AS "nik",
            COALESCE(w."nama_art", '—')            AS "nama",
            COALESCE(w."kelurahan", '—')           AS "kelurahan",
            COALESCE(u."nama", '—')                AS "petugas",
            f.nama                                 AS "formNama",
            f.kode                                 AS "formKode",
            fv.version                             AS "formVersion"
        FROM surveys s
        INNER JOIN form_versions fv ON fv.id = s."formVersionId"
        INNER JOIN forms f ON f.id = fv."formId"
        LEFT JOIN data_warga w ON w.nik = s."wargaNik"
        LEFT JOIN users u ON u.id = s."petugasId"
        ORDER BY s."tanggal" DESC
        LIMIT ${limit}
    `)
  return rows as unknown as BarisIsianForm[]
}

/** Satu baris riwayat submit untuk tab "Riwayat Submit Form". */
export interface BarisRiwayatSubmit {
  id: string
  tanggal: string
  dibuat: string
  formNama: string
  formKode: string | null
  formVersion: number
  petugas: string
  nik: string | null
  nama: string
  kelurahan: string
  jumlahJawaban: number
}

/**
 * Bentuk jsonb yang aman lewat boundary server-fn.
 *
 * `survey_entries.value` bertipe `unknown` di sisi drizzle, dan `unknown` tidak
 * lolos cek serialisasi TanStack Start. Tipe di bawah adalah jsonb yang sebenarnya
 * (tanpa `undefined`/fungsi/siklus), jadi nilai apa pun yang ada di database bisa
 * di-cast ke sini tanpa menebak-nebak.
 */
export type JsonNilai =
  string | number | boolean | null | JsonNilai[] | { [key: string]: JsonNilai }

/** Satu jawaban beserta label field-nya, untuk panel detail riwayat. */
export interface BarisJawabanSubmit {
  fieldId: string
  nama: string
  label: string
  tipe: string
  urutan: number
  /** Bentuk jsonb apa adanya; diformat di klien lewat `formatNilaiJawapan`. */
  value: JsonNilai
  /** Opsi definisi form untuk memetakan value ke label. */
  opsi: Array<{ value: string; label: string | null }>
}

/**
 * Daftar submit dari semua form, untuk tab "Riwayat Submit Form".
 *
 * Berbeda dengan `querySurveysWithWarga`: tidak ada syarat warga, dan diurutkan
 * `createdAt` (bukan `tanggal`) supaya submit yang tanggal isiannya lama tapi
 * baru dikirim tetap muncul di atas. `formId` opsional untuk menyaring satu
 * form; `q` sengaja tidak dipaksakan ke SQL — pencarian teks diserahkan ke klien
 * karena halamannya sudah mengambil 200 baris.
 */
export async function queryRiwayatSubmit(params: {
  limit?: number
  formId?: number | null
}): Promise<BarisRiwayatSubmit[]> {
  const limit = params.limit ?? 200
  const filterForm = params.formId ? sql`AND f.id = ${params.formId}` : sql``

  const rows = await db.execute(sql`
        SELECT
            s.id                                   AS "id",
            to_char(s."tanggal", 'YYYY-MM-DD')     AS "tanggal",
            to_char(s."createdAt", 'YYYY-MM-DD HH24:MI') AS "dibuat",
            f.nama                                 AS "formNama",
            f.kode                                 AS "formKode",
            fv.version                             AS "formVersion",
            COALESCE(u."nama", '—')                AS "petugas",
            s."wargaNik"                           AS "nik",
            COALESCE(w."nama_art", '—')            AS "nama",
            COALESCE(w."kelurahan", '—')           AS "kelurahan",
            (SELECT COUNT(*)::int FROM survey_entries e WHERE e."surveyId" = s.id) AS "jumlahJawaban"
        FROM surveys s
        INNER JOIN form_versions fv ON fv.id = s."formVersionId"
        INNER JOIN forms f ON f.id = fv."formId"
        LEFT JOIN data_warga w ON w.nik = s."wargaNik"
        LEFT JOIN users u ON u.id = s."petugasId"
        WHERE TRUE
        ${filterForm}
        ORDER BY s."createdAt" DESC
        LIMIT ${limit}
    `)
  return rows as unknown as BarisRiwayatSubmit[]
}

/**
 * Jawaban satu submit, lengkap dengan label field dan opsi pilihannya.
 *
 * Opsi diambil terpisah dari `form_field_options` karena satu field bisa punya
 * puluhan baris opsi; join langsung ke `survey_entries` akan mengalikan baris
 * jawaban dan membuat jumlah jawaban tidak jujur.
 */
export async function queryJawabanSubmit(
  surveyId: string,
): Promise<BarisJawabanSubmit[]> {
  const [submission] = await db
    .select({ formVersionId: surveys.formVersionId })
    .from(surveys)
    .where(eq(surveys.id, surveyId))
    .limit(1)
  if (!submission) return []
  const [version] = await db
    .select({ schema: formVersions.schema })
    .from(formVersions)
    .where(eq(formVersions.id, submission.formVersionId))
    .limit(1)
  if (!version) return []
  const definition = parseFormDefinition(version.schema)
  const metadata = new Map(
    definition.sections.flatMap((section) =>
      section.fields.map((field) => [field.id, field] as const),
    ),
  )
  const jawaban = await db
    .select({
      fieldId: surveyEntries.fieldId,
      value: surveyEntries.value,
    })
    .from(surveyEntries)
    .where(eq(surveyEntries.surveyId, surveyId))

  if (jawaban.length === 0) return []
  return jawaban.flatMap((j) => {
    const field = metadata.get(j.fieldId)
    if (!field) return []
    return [
      {
        fieldId: field.id,
        nama: field.name,
        label: field.label,
        tipe: field.type,
        urutan: field.order,
        value: j.value as JsonNilai,
        opsi: field.options.map(({ value, label }) => ({ value, label })),
      },
    ]
  })
}

/**
 * Satu baris ringkas untuk satu `surveyId`, dipakai panel detail riwayat.
 *
 * Query terpisah, bukan mencari di hasil `querySurveysWithWarga`: daftar itu
 * dibatasi 500 baris terbaru, jadi submit lama tidak akan ketemu di sana.
 */
export async function queryRingkasanSubmit(
  surveyId: string,
): Promise<BarisIsianForm | null> {
  const rows = await db.execute(sql`
        SELECT
            s.id                                   AS "id",
            to_char(s."tanggal", 'YYYY-MM-DD')     AS "tanggal",
            s."wargaNik"                           AS "nik",
            COALESCE(w."nama_art", '—')            AS "nama",
            COALESCE(w."kelurahan", '—')           AS "kelurahan",
            COALESCE(u."nama", '—')                AS "petugas",
            f.nama                                 AS "formNama",
            f.kode                                 AS "formKode",
            fv.version                             AS "formVersion"
        FROM surveys s
        INNER JOIN form_versions fv ON fv.id = s."formVersionId"
        INNER JOIN forms f ON f.id = fv."formId"
        LEFT JOIN data_warga w ON w.nik = s."wargaNik"
        LEFT JOIN users u ON u.id = s."petugasId"
        WHERE s.id = ${surveyId}
        LIMIT 1
    `)
  const baris = rows as unknown as BarisIsianForm[]
  return baris[0] ?? null
}

/** Form yang punya submission, untuk dropdown filter tab riwayat. */
export async function queryFormAdaSubmit(): Promise<
  Array<{ formId: number; nama: string; jumlahSubmit: number }>
> {
  const rows = await db.execute(sql`
        SELECT f.id AS "formId", f.nama AS "nama", COUNT(s.id)::int AS "jumlahSubmit"
        FROM surveys s
        INNER JOIN form_versions fv ON fv.id = s."formVersionId"
        INNER JOIN forms f ON f.id = fv."formId"
        GROUP BY f.id, f.nama
        ORDER BY f.nama
    `)
  return rows as unknown as Array<{
    formId: number
    nama: string
    jumlahSubmit: number
  }>
}
