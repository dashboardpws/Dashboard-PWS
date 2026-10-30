/**
 * Template field kunjungan rumah dari DB, serta record kunjungan (simpan, ubah, hapus).
 * Warga sasaran yang ikut tersimpan diurus di `sasaran.server.ts`.
 */

import type { TemplateQuestionRow } from '@/lib/kunjungan-rumah/template/template-from-rows'
import { KODE_FORM_BAWAAN } from '@/lib/constants'
import { PEMBATAS_NAMA_FIELD } from '@/lib/kunjungan-rumah/template/template-from-rows'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { barisWargaDariPayload, simpanWargaSasaran } from './sasaran.server'
import { db } from './db.server'
import {
  formFieldOptions,
  formFields,
  formSections,
  formVersions,
  forms,
  surveyEntries,
  surveys,
} from '@/lib/schema/schema'
import { isValidNik } from '@/lib/utils'
import { pastikanPetugasValid } from '@/lib/server/petugas/user-registry.server'

export // ---- kunjungan rumah langsung ke DB — pengganti localStorage `pws-kunjungan-rumah` ----
type JsonRecord = Record<string, unknown>

function asJsonRecord(v: unknown): JsonRecord {
  if (!v || typeof v !== 'object' || Array.isArray(v))
    throw new Error('Payload tidak valid')
  return v as JsonRecord
}

/** Foto untuk DB: teruskan id/name/fileUrl/dataUrl/caption/takenAt.
 *  dataUrl (base64) disimpan inline di jsonb — Postgres/TOAST menanganinya
 *  (batas kuota hanya berlaku untuk localStorage, bukan DB).
 *  fileUrl Supabase Storage siap dipakai setelah bucket `dokumentasi` tersedia
 *  di proyek yang sama dengan VITE_SUPABASE_URL (saat ini DB dan API beda proyek).
 */
function cleanFotos(fotos: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(fotos)) return []
  return fotos.map((f) => {
    const o = (f ?? {}) as Record<string, unknown>
    const out: Record<string, unknown> = {
      id: typeof o.id === 'string' ? o.id : '',
      name: typeof o.name === 'string' ? o.name : 'foto.jpg',
      caption: typeof o.caption === 'string' ? o.caption : '',
      takenAt:
        typeof o.takenAt === 'string' ? o.takenAt : new Date().toISOString(),
    }
    if (typeof o.fileUrl === 'string' && o.fileUrl) out.fileUrl = o.fileUrl
    if (typeof o.dataUrl === 'string' && o.dataUrl) out.dataUrl = o.dataUrl
    return out
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

  const sectionRows = await db
    .select({ id: formSections.id, nama: formSections.nama })
    .from(formSections)
    .where(eq(formSections.formVersionId, form.formVersionId))
    .orderBy(formSections.urutan)

  if (sectionRows.length === 0)
    return {
      formVersionId: form.formVersionId,
      versiDefinisi: form.version,
      questions: {},
    }

  const sectionIds = sectionRows.map((row) => row.id)
  const namaById = new Map(sectionRows.map((row) => [row.id, row.nama]))

  const fieldRows = await db
    .select({
      id: formFields.id,
      sectionId: formFields.sectionId,
      nama: formFields.nama,
      label: formFields.label,
      tipe: formFields.tipe,
      // Bucket layout panel sasaran disimpan di `optionSourceKey`prefix `bucket=`.
      // `form_fields` tidak punya kolom `bucket` sendiri; prefixed key dipakai supaya
      // satu kolom varchar tetap bisa menyimpan dua hal tanpa menambah kolom.
      optionSourceKey: formFields.optionSourceKey,
      deskripsi: formFields.deskripsi,
      wajib: formFields.wajib,
      urutan: formFields.urutan,
      aktif: formFields.aktif,
    })
    .from(formFields)
    .where(inArray(formFields.sectionId, sectionIds))
    .orderBy(formFields.urutan)

  // Opsi = baris `form_field_options` milik field. Satu query untuk semua field
  // lalu di-group di memory supaya tidak jadi N+1. Baris nonaktif ikut diambil
  // supaya urutan opsi tidak berubah kalau admin menonaktifkan lalu
  // mengaktifkan lagi lewat Form Builder; penyingkirannya dilakukan di bawah.
  const optionRows =
    fieldRows.length === 0
      ? []
      : await db
          .select({
            fieldId: formFieldOptions.fieldId,
            value: formFieldOptions.value,
            aktif: formFieldOptions.aktif,
          })
          .from(formFieldOptions)
          .where(
            inArray(
              formFieldOptions.fieldId,
              fieldRows.map((row) => row.id),
            ),
          )
          .orderBy(formFieldOptions.urutan)

  const opsiByField = new Map<string, string[]>()
  for (const row of optionRows) {
    if (!row.aktif) continue
    if (typeof row.value !== 'string') continue
    const list = opsiByField.get(row.fieldId)
    if (list) list.push(row.value)
    else opsiByField.set(row.fieldId, [row.value])
  }

  const bySection: Record<string, TemplateQuestionRow[]> = {}
  for (const row of fieldRows) {
    const sectionNama = namaById.get(row.sectionId)
    if (!sectionNama) continue
    const entry: TemplateQuestionRow = {
      fieldId: row.id,
      sectionId: row.sectionId,
      kode: namaFieldTanpaPrefix(row.nama),
      pertanyaan: row.label,
      tipe: row.tipe,
      bucket: parseBucket(row.optionSourceKey),
      hint: row.deskripsi,
      wajib: row.wajib,
      urutan: row.urutan,
      aktif: row.aktif,
      opsi: opsiByField.get(row.id) ?? [],
    }
    const list = bySection[sectionNama]
    if (list) list.push(entry)
    else bySection[sectionNama] = [entry]
  }

  return {
    formVersionId: form.formVersionId,
    versiDefinisi: form.version,
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
  const [row] = await db
    .select({ id: formFields.id })
    .from(formFields)
    .where(
      and(
        eq(formFields.formVersionId, formVersionId),
        eq(formFields.nama, NAMA_FIELD_RECORD_LEGACY),
      ),
    )
    .limit(1)
  return row?.id ?? null
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
  const rows = await db
    .select({
      id: surveys.id,
      tanggal: surveys.tanggal,
      createdAt: surveys.createdAt,
      value: surveyEntries.value,
    })
    .from(surveys)
    .innerJoin(surveyEntries, eq(surveyEntries.surveyId, surveys.id))
    .innerJoin(formFields, eq(formFields.id, surveyEntries.fieldId))
    .where(
      and(
        inArray(surveys.formVersionId, versionIds),
        eq(formFields.nama, NAMA_FIELD_RECORD_LEGACY),
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

export async function getKunjunganRumahRecord(id: string) {
  const [row] = await db
    .select({ value: surveyEntries.value })
    .from(surveyEntries)
    .innerJoin(formFields, eq(formFields.id, surveyEntries.fieldId))
    .where(
      and(
        eq(surveyEntries.surveyId, id),
        eq(formFields.nama, NAMA_FIELD_RECORD_LEGACY),
      ),
    )
    .limit(1)
  const payload = row?.value
  if (!payload || typeof payload !== 'object' || Array.isArray(payload))
    return null
  const rec = payload as JsonRecord
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
  const barisWarga = await barisWargaDariPayload(rec)

  await db.transaction(async (tx) => {
    // `surveys.wargaNik` punya FK ke `data_warga.nik`, jadi warga sasaran
    // ditulis lebih dulu. NIK yang sudah terdaftar tidak ditimpa.
    await simpanWargaSasaran(tx, barisWarga)
    await tx.insert(surveys).values({
      id,
      formVersionId: form.formVersionId,
      wargaNik: barisWarga.nik,
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
    const barisWarga = await barisWargaDariPayload(clean)
    await db.transaction(async (tx) => {
      await simpanWargaSasaran(tx, barisWarga)
      await tx
        .update(surveys)
        .set({
          wargaNik: barisWarga.nik,
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
