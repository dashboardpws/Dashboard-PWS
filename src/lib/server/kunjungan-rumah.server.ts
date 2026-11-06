/**
 * Template field kunjungan rumah dari DB, serta record kunjungan (simpan, ubah, hapus).
 * Warga sasaran yang ikut tersimpan diurus di `sasaran.server.ts`.
 */

import type {
  TemplateQuestionRow,
  TemplateSectionRow,
} from '@/lib/kunjungan-rumah/template/template-from-rows'
import { KODE_FORM_BAWAAN, MAX_FOTO } from '@/lib/constants'
import { pathDariFileUrl, pathFotoValid, signedUrls } from './storage.server'
import { PEMBATAS_NAMA_FIELD } from '@/lib/kunjungan-rumah/template/template-from-rows'
import { and, count, desc, eq, gte, inArray, lt, or, sql } from 'drizzle-orm'
import {
  barisWargaKeluargaDariPayload,
  simpanWargaSasaran,
} from './sasaran.server'
import { db } from './db.server'
import {
  formVersions,
  forms,
  surveyEntries,
  surveys,
} from '@/lib/schema/schema'
import { isValidNik } from '@/lib/utils'
import { pastikanPetugasValid } from '@/lib/server/petugas/user-registry.server'
import { parseFormDefinition } from '@/lib/form-builder/form-schema'
import type {
  KunjunganRumahDashboardKategori,
  KunjunganRumahDashboardPage,
  KunjunganRumahDashboardPageInput,
  KunjunganRumahDashboardStatus,
  MonthlyKunjunganRumahStat,
} from '@/lib/kunjungan-rumah/dashboard'
import { sanitizeRecord } from '@/lib/kunjungan-rumah/types'

export // ---- kunjungan rumah langsung ke DB — pengganti localStorage `pws-kunjungan-rumah` ----
type JsonRecord = Record<string, unknown>

function asJsonRecord(v: unknown): JsonRecord {
  if (!v || typeof v !== 'object' || Array.isArray(v))
    throw new Error('Payload tidak valid')
  return v as JsonRecord
}

/** Foto untuk DB: simpan `path` object, bukan URL.
 *  Upload baru selalu menghasilkan `path`; `fileUrl`/`dataUrl` hanya
 *  dipertahankan untuk record lama yang belum punya `path`, supaya tidak hilang
 *  saat record itu diedit. Signed URL dibuat saat baca, tidak pernah disimpan.
 */
function cleanFotos(fotos: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(fotos)) return []
  return fotos.slice(0, MAX_FOTO).map((f) => {
    const o = (f ?? {}) as Record<string, unknown>
    const out: Record<string, unknown> = {
      id: typeof o.id === 'string' ? o.id : '',
      name: typeof o.name === 'string' ? o.name : 'foto.jpg',
      caption: typeof o.caption === 'string' ? o.caption : '',
      takenAt:
        typeof o.takenAt === 'string' ? o.takenAt : new Date().toISOString(),
    }
    if (typeof o.path === 'string' && pathFotoValid(o.path)) {
      out.path = o.path
      return out
    }
    if (typeof o.fileUrl === 'string' && o.fileUrl) out.fileUrl = o.fileUrl
    if (typeof o.dataUrl === 'string' && o.dataUrl) out.dataUrl = o.dataUrl
    return out
  })
}

/** Object path sebuah foto, dari `path` baru atau `fileUrl` publik lama. */
function pathFoto(f: unknown): string | null {
  if (!f || typeof f !== 'object') return null
  const o = f as Record<string, unknown>
  if (typeof o.path === 'string' && pathFotoValid(o.path)) return o.path
  if (typeof o.fileUrl === 'string') return pathDariFileUrl(o.fileUrl)
  return null
}

/** Tempelkan signed URL ke tiap foto saat dibaca.
 *
 *  DB hanya menyimpan `path`; signed URL berumur pendek jadi dibuat ulang tiap
 *  baca. Foto lama tanpa `path` diambil dari `fileUrl` publik yang sudah
 *  tersimpan, jadi tetap tampil walau belum di-backfill. Kalau signing gagal,
 *  foto dikembalikan apa adanya supaya halaman tidak ikut gagal.
 */
async function fotosBerUrl(
  fotos: unknown,
): Promise<Array<Record<string, unknown>>> {
  if (!Array.isArray(fotos)) return []
  const asal = fotos.map(pathFoto).filter((p): p is string => !!p)
  const signed = await signedUrls(asal)
  return fotos.map((f) => {
    if (!f || typeof f !== 'object') return {}
    const baris = f as Record<string, unknown>
    const path = pathFoto(f)
    const url = path ? signed[path] : undefined
    return url ? { ...baris, fileUrl: url } : baris
  })
}

// ---- definisi form kunjungan rumah dari DB ----
// Definisi form (section + field + opsi) dibaca dari tabel v2: `form_sections`,
// `form_fields`, `form_field_options`. Record jawaban ditulis ke `surveys` +
// `survey_entries`; lihat catatan mapping di `saveKunjunganRumahRecord`.

/**
 * Form + versi published terbaru untuk form kunjungan rumah.
 *
 * Dicari lewat `forms.kode`, bukan `forms.nama`: `nama` boleh diubah admin lewat
 * Form Builder, sedangkan `kode` dikunci seeder. Kalau lewat `nama`, satu
 * rename saja membuat seluruh form kader jatuh ke template fallback tanpa error
 * yang jelas. Lihat `KODE_FORM_BAWAAN` di src/lib/constants.ts.
 */
async function getKunjunganRumahForm() {
  const [row] = await db
    .select({
      id: forms.id,
      nama: forms.nama,
      formVersionId: formVersions.id,
      version: formVersions.version,
    })
    .from(forms)
    .innerJoin(formVersions, eq(formVersions.formId, forms.id))
    .where(
      and(
        eq(forms.kode, KODE_FORM_BAWAAN.kunjunganRumah),
        eq(formVersions.status, 'published'),
      ),
    )
    .orderBy(desc(formVersions.version))
    .limit(1)
  return row ?? null
}

/**
 * Id SEMUA versi form kunjungan rumah, apa pun statusnya.
 *
 * Berbeda dengan `getKunjunganRumahForm()` yang sengaja terkunci ke versi
 * published terbaru — itu untuk membaca definisi form dan untuk menulis record
 * baru. Untuk menghitung record yang sudah ada, versi tidak boleh jadi filter:
 * begitu admin menerbitkan revisi definisi lewat Form Builder, versi lama jadi
 * `archived`, dan record yang dibuat padanya ikut hilang dari rekap hanya karena
 * definisi form berubah. Data petugas tidak boleh hilang begitu saja.
 *
 * Versi baru tetap membaca definisi terbaru; record lamanya tetap bisa dibuka
 * karena `getKunjunganRumahRecord()` mencari lewat `surveys.id`.
 */
async function semuaVersiKunjunganRumah(): Promise<string[] | null> {
  const rows = await db
    .select({ id: formVersions.id })
    .from(forms)
    .innerJoin(formVersions, eq(formVersions.formId, forms.id))
    .where(eq(forms.kode, KODE_FORM_BAWAAN.kunjunganRumah))
  if (rows.length === 0) return null
  return rows.map((r) => r.id)
}

export async function getKunjunganRumahTemplateRows() {
  const form = await getKunjunganRumahForm()
  if (!form) return null
  const [version] = await db
    .select({ schema: formVersions.schema })
    .from(formVersions)
    .where(eq(formVersions.id, form.formVersionId))
    .limit(1)
  if (!version) return null
  const definition = parseFormDefinition(version.schema)
  const sectionRows = definition.sections
  const sections: TemplateSectionRow[] = sectionRows.map((section) => ({
    sectionId: section.id,
    nama: section.name,
    label: section.label || section.name,
    description: section.description,
    urutan: section.order,
    aktif: section.active,
    sectionKind: section.sectionKind ?? null,
    layoutGroups: section.layoutGroups ?? [],
  }))
  const kodeById = new Map(
    sectionRows.flatMap((section) =>
      section.fields.map(
        (field) => [field.id, namaFieldTanpaPrefix(field.name)] as const,
      ),
    ),
  )
  if (sectionRows.length === 0)
    return {
      formVersionId: form.formVersionId,
      versiDefinisi: form.version,
      sections: [],
      questions: {},
    }
  const bySection: Record<string, TemplateQuestionRow[]> = {}
  for (const section of sectionRows) {
    for (const field of section.fields) {
      const entry: TemplateQuestionRow = {
        fieldId: field.id,
        sectionId: section.id,
        kode: namaFieldTanpaPrefix(field.name),
        pertanyaan: field.label,
        tipe: field.type,
        bucket: parseBucket(field.optionSourceKey),
        hint: field.description,
        wajib: field.required,
        urutan: field.order,
        aktif: field.active,
        opsi: field.options
          .filter((option) => option.active)
          .map((option) => option.value),
        placeholder: field.placeholder,
        columns: field.columns,
        layoutGroup: field.layoutGroup ?? null,
        visibilityRules: field.visibilityRules.flatMap((rule) => {
          if (rule.targetType !== 'field') return []
          const triggerFieldId = kodeById.get(rule.triggerFieldId)
          const targetId = kodeById.get(rule.targetId)
          if (!triggerFieldId || !targetId) return []
          return [
            { ...rule, targetType: 'field' as const, targetId, triggerFieldId },
          ]
        }),
      }
      const list = bySection[section.name]
      if (list) list.push(entry)
      else bySection[section.name] = [entry]
    }
  }

  return {
    formVersionId: form.formVersionId,
    versiDefinisi: form.version,
    sections,
    questions: bySection,
  }
}

/**
 * Buka lagi `<section>::<id>` jadi `<id>`.
 *
 * `form_fields.nama` wajib unik per versi form, tapi template lokal memakai
 * ulang id antar section (`nama` dan `nik` muncul di banyak section). Seeder
 * karena itu menyimpan `<section>::<id>`; di sini prefix-nya dibuang supaya
 * `templateFromRows()` menerima id yang sama seperti template lokal.
 *
 * Field yang tidak punya prefix dikembalikan utuh, supaya baris yang dibuat
 * manual di Form Builder (yang tidak lewat seeder) tetap terbaca.
 */
function namaFieldTanpaPrefix(nama: string): string {
  const found = nama.indexOf(PEMBATAS_NAMA_FIELD)
  return found === -1 ? nama : nama.slice(found + PEMBATAS_NAMA_FIELD.length)
}

/** Baca bucket dari prefix `bucket=` pada `form_fields.optionSourceKey`. */
function parseBucket(key: string | null): string | null {
  if (!key) return null
  const found = key.split(';').find((part) => part.trim().startsWith('bucket='))
  return found ? found.trim().slice('bucket='.length) || null : null
}

// ---- record kunjungan rumah di atas tabel v2 ----
// Record lama adalah satu baris jsonb (`kunjungan_rumah_records.payload`) berisi
// seluruh isian form sekaligus. Schema v2 tidak punya tabel jsonb tunggal, jadi isian
// itu dipetakan ke `surveys` (header) + `survey_entries` (satu baris jawaban).
//
// PEMETAAN SAMPAI SEKARANG: seluruh isian legacy disimpan sebagai SATU entry jsonb di
// field `record_legacy`. Bentuk jsonb di API sengaja tidak diubah supaya UI yang sudah
// jalan (src/components/kunjungan-rumah, src/hooks/kunjungan-rumah, routes) tidak perlu disentuh. Kolom
// `surveys` yang bisa terisi — `wargaNik`, `petugasId`, `tanggal` — tetap diisi dari
// `info` supaya filter dashboard, sasaran, dan laporan tetap bekerja.
//
// Batasnya yang perlu diketahui: rekap per-field ("berapa warga dengan TD tinggi?")
// belum bisa dijawab, karena itu butuh `survey_entries` satu baris per field, dan
// memecah payload legacy ke level field adalah pekerjaan tersendiri.

/** Field tempat seluruh payload legacy disimpan. Wajib ada di seed form kunjungan. */
const FIELD_RECORD_LEGACY = 'record_legacy'

/**
 * Nama field di database untuk field di atas.
 *
 * `form_fields.nama` unik per versi form dan template lokal memakai ulang id
 * antar section, jadi seeder menyimpan `<section>::<id>`. Section `penyimpanan`
 * hanya dibuat oleh seeder; lihat `namaFieldUnik()` di scripts/seed-form-defaults.ts.
 * Kedua sisi harus diubah bersamaan — `pnpm db:check-parity` adalah penjaganya.
 */
const NAMA_FIELD_RECORD_LEGACY = 'penyimpanan::' + FIELD_RECORD_LEGACY

async function fieldIdRecordLegacy(
  formVersionId: string,
): Promise<string | null> {
  const [version] = await db
    .select({ schema: formVersions.schema })
    .from(formVersions)
    .where(eq(formVersions.id, formVersionId))
    .limit(1)
  const definition = version ? parseFormDefinition(version.schema) : null
  return (
    definition?.sections
      .flatMap((section) => section.fields)
      .find((field) => field.name === NAMA_FIELD_RECORD_LEGACY)?.id ?? null
  )
}

/** Baca metadata header dari `info` di payload legacy. */
function headerDariPayload(rec: JsonRecord): {
  wargaNik: string
  petugasId: string
  tanggal: string
} {
  const info =
    rec.info && typeof rec.info === 'object' ? (rec.info as JsonRecord) : {}
  const nik = typeof info.nik === 'string' ? info.nik.trim() : ''
  const petugasId =
    typeof info.petugasId === 'string' ? info.petugasId.trim() : ''
  const tgl =
    typeof info.tglPengumpulan === 'string' ? info.tglPengumpulan.trim() : ''
  const waktuSimpan = typeof rec.waktuSimpan === 'string' ? rec.waktuSimpan : ''
  return {
    wargaNik: nik,
    petugasId,
    tanggal: tgl || waktuSimpan.slice(0, 10),
  }
}

export async function listKunjunganRumahRecords() {
  // Semua versi ikut, bukan cuma published terbaru: lihat catatan
  // `semuaVersiKunjunganRumah()`.
  const versionIds = await semuaVersiKunjunganRumah()
  if (!versionIds) return []
  const fieldIds = (
    await Promise.all(versionIds.map((id) => fieldIdRecordLegacy(id)))
  ).filter((id): id is string => id !== null)
  if (fieldIds.length === 0) return []
  const rows = await db
    .select({
      id: surveys.id,
      tanggal: surveys.tanggal,
      createdAt: surveys.createdAt,
      value: surveyEntries.value,
    })
    .from(surveys)
    .innerJoin(surveyEntries, eq(surveyEntries.surveyId, surveys.id))
    .where(
      and(
        inArray(surveys.formVersionId, versionIds),
        inArray(surveyEntries.fieldId, fieldIds),
      ),
    )
    .orderBy(desc(surveys.createdAt))
  return rows
    .map((r) => r.value)
    .filter(
      (v): v is JsonRecord => !!v && typeof v === 'object' && !Array.isArray(v),
    )
    .map((payload) => ({ id: String(payload.id ?? ''), ...payload }))
}

async function fieldVersiKunjunganRumah() {
  const versions = await db
    .select({ versionId: formVersions.id, schema: formVersions.schema })
    .from(forms)
    .innerJoin(formVersions, eq(formVersions.formId, forms.id))
    .where(eq(forms.kode, KODE_FORM_BAWAAN.kunjunganRumah))

  return versions.flatMap(({ versionId, schema }) => {
    const definition = parseFormDefinition(schema)
    const fieldId = definition.sections
      .flatMap((section) => section.fields)
      .find((field) => field.name === NAMA_FIELD_RECORD_LEGACY)?.id
    return fieldId ? [{ versionId, fieldId }] : []
  })
}

function pasanganVersiField(
  fields: Array<{ versionId: string; fieldId: string }>,
) {
  return or(
    ...fields.map(({ versionId, fieldId }) =>
      and(
        eq(surveys.formVersionId, versionId),
        eq(surveyEntries.fieldId, fieldId),
      ),
    ),
  )
}

function rentangBulan(month: string) {
  const year = Number(month.slice(0, 4))
  const monthNumber = Number(month.slice(5, 7))
  const start = new Date(Date.UTC(year, monthNumber - 1, 1))
  const end = new Date(Date.UTC(year, monthNumber, 1))
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  }
}

const recordValue = surveyEntries.value
const adaMasalah = sql<boolean>`exists (
  select 1 from jsonb_array_elements(
    case when jsonb_typeof(${recordValue}->'masalah') = 'array'
      then ${recordValue}->'masalah' else '[]'::jsonb end
  ) as masalah(item)
  where nullif(item->>'masalah', '') is not null
     or nullif(item->>'tindakLanjut', '') is not null
)`
const adaTindakLanjut = sql<boolean>`exists (
  select 1 from jsonb_array_elements(
    case when jsonb_typeof(${recordValue}->'masalah') = 'array'
      then ${recordValue}->'masalah' else '[]'::jsonb end
  ) as masalah(item) where nullif(item->>'tindakLanjut', '') is not null
)`

function kondisiKategori(category: KunjunganRumahDashboardKategori) {
  if (category === 'all') return undefined
  const sasaranByCategory: Record<
    Exclude<KunjunganRumahDashboardKategori, 'all'>,
    string
  > = {
    balita: 'balita',
    'ibu-hamil': 'ibu-hamil',
    lansia: 'lansia',
  }
  const sasaran = sasaranByCategory[category]
  return sql`${recordValue}->'penilaian' @> ${JSON.stringify([{ sasaran }])}::jsonb`
}

function kondisiStatus(status: KunjunganRumahDashboardStatus) {
  if (status === 'berisiko') return adaMasalah
  if (status === 'sehat') return sql`not (${adaMasalah})`
  return undefined
}

/** Rekap grafik dan drawer sama-sama dibatasi ke payload form kunjungan rumah. */
export async function queryKunjunganRumahMonthlyStats(): Promise<
  MonthlyKunjunganRumahStat[]
> {
  const fields = await fieldVersiKunjunganRumah()
  if (fields.length === 0) return []

  const now = new Date()
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1),
  )
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
  const startDate = start.toISOString().slice(0, 10)
  const endDate = end.toISOString().slice(0, 10)
  const month = sql<string>`to_char(${surveys.tanggal}, 'YYYY-MM')`
  const posyandu = sql<string>`coalesce(${recordValue}->'info'->>'posyandu', 'Tidak diketahui')`
  const rows = await db
    .select({ month, posyandu, count: count() })
    .from(surveys)
    .innerJoin(surveyEntries, eq(surveyEntries.surveyId, surveys.id))
    .where(
      and(
        pasanganVersiField(fields),
        gte(surveys.tanggal, startDate),
        lt(surveys.tanggal, endDate),
      ),
    )
    .groupBy(month, posyandu)
    .orderBy(month)

  const grouped = new Map<string, MonthlyKunjunganRumahStat>()
  for (const row of rows) {
    let stat = grouped.get(row.month)
    if (!stat) {
      stat = {
        month: row.month,
        label: new Date(`${row.month}-01T00:00:00`).toLocaleDateString(
          'id-ID',
          { month: 'short', year: '2-digit' },
        ),
        totalKunjungan: 0,
        byPosyandu: [],
      }
      grouped.set(row.month, stat)
    }
    stat.totalKunjungan += row.count
    stat.byPosyandu.push({ nama: row.posyandu, count: row.count })
  }
  return [...grouped.values()]
}

export async function queryKunjunganRumahDashboardPage(
  input: KunjunganRumahDashboardPageInput,
): Promise<KunjunganRumahDashboardPage> {
  const fields = await fieldVersiKunjunganRumah()
  if (fields.length === 0) {
    return {
      records: [],
      total: 0,
      page: input.page,
      pageSize: 10,
      summary: { total: 0, flagged: 0, followedUp: 0 },
    }
  }

  const { start, end } = rentangBulan(input.month)
  const baseConditions = [
    pasanganVersiField(fields),
    gte(surveys.tanggal, start),
    lt(surveys.tanggal, end),
  ]
  const summaryWhere = and(...baseConditions)

  const search = input.search.trim()
  const searchCondition = search
    ? or(
        sql`${recordValue}->'info'->>'namaKK' ilike ${`%${search}%`}`,
        sql`${recordValue}->'info'->>'nik' ilike ${`%${search}%`}`,
      )
    : undefined
  const conditions = [
    ...baseConditions,
    searchCondition,
    kondisiKategori(input.category),
    kondisiStatus(input.status),
  ]
  const where = and(...conditions)
  const [summaryRows, totalRows] = await Promise.all([
    db
      .select({
        total: count(),
        flagged: sql<number>`count(*) filter (where ${adaMasalah})`,
        followedUp: sql<number>`count(*) filter (where ${adaTindakLanjut})`,
      })
      .from(surveys)
      .innerJoin(surveyEntries, eq(surveyEntries.surveyId, surveys.id))
      .where(summaryWhere),
    db
      .select({ total: count() })
      .from(surveys)
      .innerJoin(surveyEntries, eq(surveyEntries.surveyId, surveys.id))
      .where(where),
  ])
  const summary = summaryRows[0]
  const totalRow = totalRows[0]
  const pageSize = 10
  const page = Math.max(1, input.page)
  const rows = await db
    .select({ id: surveys.id, value: surveyEntries.value })
    .from(surveys)
    .innerJoin(surveyEntries, eq(surveyEntries.surveyId, surveys.id))
    .where(where)
    .orderBy(desc(surveys.tanggal), desc(surveys.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  return {
    records: rows.flatMap((row) => {
      if (
        !row.value ||
        typeof row.value !== 'object' ||
        Array.isArray(row.value)
      )
        return []
      const record = sanitizeRecord({ ...row.value, id: row.id })
      return record ? [record] : []
    }),
    total: totalRow?.total ?? 0,
    page,
    pageSize,
    summary: {
      total: summary?.total ?? 0,
      flagged: Number(summary?.flagged ?? 0),
      followedUp: Number(summary?.followedUp ?? 0),
    },
  }
}

export async function getKunjunganRumahRecord(id: string) {
  const [survey] = await db
    .select({ formVersionId: surveys.formVersionId })
    .from(surveys)
    .where(eq(surveys.id, id))
    .limit(1)
  if (!survey) return null
  const fieldId = await fieldIdRecordLegacy(survey.formVersionId)
  if (!fieldId) return null
  const [row] = await db
    .select({ value: surveyEntries.value })
    .from(surveyEntries)
    .where(
      and(eq(surveyEntries.surveyId, id), eq(surveyEntries.fieldId, fieldId)),
    )
    .limit(1)
  const payload = row?.value
  if (!payload || typeof payload !== 'object' || Array.isArray(payload))
    return null
  const rec: JsonRecord = { ...(payload as JsonRecord) }
  rec.fotos = await fotosBerUrl(rec.fotos)
  return { id, ...rec }
}

export async function saveKunjunganRumahRecord(payload: unknown) {
  const rec = asJsonRecord(payload)
  if (typeof rec.waktuSimpan !== 'string' || !rec.waktuSimpan)
    throw new Error('waktuSimpan wajib diisi')
  if (!rec.info || typeof rec.info !== 'object')
    throw new Error('info keluarga wajib diisi')

  const form = await getKunjunganRumahForm()
  if (!form)
    throw new Error(
      'Form kunjungan rumah belum ada di database. Jalankan `pnpm db:seed`.',
    )
  const fieldId = await fieldIdRecordLegacy(form.formVersionId)
  if (!fieldId) {
    throw new Error(
      `Field "${FIELD_RECORD_LEGACY}" belum ada di form kunjungan rumah. Jalankan \`pnpm db:seed\` untuk membuat definisi form yang cocok dengan kode.`,
    )
  }

  const head = headerDariPayload(rec)
  if (!head.tanggal) throw new Error('Tanggal kunjungan wajib diisi')
  if (!isValidNik(head.wargaNik)) {
    throw new Error('NIK sasaran utama wajib 16 digit.')
  }
  const petugas = await pastikanPetugasValid(head.petugasId)

  const id = typeof rec.id === 'string' && rec.id ? rec.id : crypto.randomUUID()
  const clean: JsonRecord = { ...rec, id, fotos: cleanFotos(rec.fotos) }
  const barisWarga = await barisWargaKeluargaDariPayload(rec)

  await db.transaction(async (tx) => {
    // `surveys.wargaNik` punya FK ke `data_warga.nik`, jadi data anggota
    // diperbarui lebih dulu dalam transaksi yang sama.
    await simpanWargaSasaran(tx, barisWarga)
    await tx.insert(surveys).values({
      id,
      formVersionId: form.formVersionId,
      wargaNik: head.wargaNik,
      petugasId: petugas.id,
      tanggal: head.tanggal,
    })
    await tx.insert(surveyEntries).values({
      surveyId: id,
      fieldId,
      value: clean,
    })
  })
  return { id, ...clean }
}

export async function updateKunjunganRumahRecord(id: string, payload: unknown) {
  const rec = asJsonRecord(payload)
  const clean: JsonRecord = { ...rec, id, fotos: cleanFotos(rec.fotos) }

  const [header] = await db
    .select({ formVersionId: surveys.formVersionId })
    .from(surveys)
    .where(eq(surveys.id, id))
    .limit(1)
  if (!header) throw new Error('Kunjungan rumah tidak ditemukan')

  const fieldId = await fieldIdRecordLegacy(header.formVersionId)
  if (!fieldId)
    throw new Error(
      `Field "${FIELD_RECORD_LEGACY}" tidak ada di form versi ini`,
    )

  const head = headerDariPayload(clean)
  if (head.wargaNik && head.petugasId) {
    // Sama seperti saat menyimpan: warga sasaran ditulis dulu kalau belum
    // terdaftar, supaya `surveys.wargaNik` tidak menggagalkan update.
    if (!head.tanggal) throw new Error('Tanggal kunjungan wajib diisi')
    if (!isValidNik(head.wargaNik)) {
      throw new Error('NIK sasaran utama wajib 16 digit.')
    }
    const petugas = await pastikanPetugasValid(head.petugasId)
    const barisWarga = await barisWargaKeluargaDariPayload(clean)
    await db.transaction(async (tx) => {
      await simpanWargaSasaran(tx, barisWarga)
      await tx
        .update(surveys)
        .set({
          wargaNik: head.wargaNik,
          petugasId: petugas.id,
          tanggal: head.tanggal,
        })
        .where(eq(surveys.id, id))
      await tx
        .delete(surveyEntries)
        .where(
          and(
            eq(surveyEntries.surveyId, id),
            eq(surveyEntries.fieldId, fieldId),
          ),
        )
      await tx
        .insert(surveyEntries)
        .values({ surveyId: id, fieldId, value: clean })
    })
    return { id, ...clean }
  }

  // Entry lama ditimpa: `survey_entries` punya UNIQUE (surveyId, fieldId) dan tidak
  // punya kolom untuk patch sebagian, jadi delete-then-insert satu baris.
  await db
    .delete(surveyEntries)
    .where(
      and(eq(surveyEntries.surveyId, id), eq(surveyEntries.fieldId, fieldId)),
    )
  await db.insert(surveyEntries).values({ surveyId: id, fieldId, value: clean })
  return { id, ...clean }
}

export async function removeKunjunganRumahRecord(id: string) {
  // `survey_entries` cascade dari `surveys`, jadi cukup hapus header.
  await db.delete(surveys).where(eq(surveys.id, id))
}
