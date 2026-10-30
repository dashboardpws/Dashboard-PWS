import { eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/server/db.server'
import {
  formFieldOptions,
  formFields,
  formFieldAutofills,
  formFieldVisibilityRules,
  formSections,
  formVersions,
  forms,
} from '@/lib/schema/schema'
import { KesalahanValidasi } from './form-version.server'
import { namaTanpaPrefix } from '@/lib/form-builder/kode-bawaan'
import type {
  RuleAutofill,
  RuleVisibilitas,
} from '@/lib/form-builder/engine/types'

/** Satu pilihan jawaban milik satu field. */
export interface OpsiDefinisiField {
  id: string
  fieldId: string
  value: string
  label: string | null
  urutan: number
  aktif: boolean
}

/**
 * Versi form beserta section, field, dan pilihan jawabannya, untuk render editor.
 *
 * Field dan opsi diambil satu query per tabel memakai `inArray`, lalu
 * dikelompokkan di memori. Total tiga query, tidak N+1 per section.
 *
 * Nama field form bawaan dikembalikan dalam bentuk pendeknya. Database menyimpan
 * `<section>::<id>` supaya nama tetap unik per versi form walau id-nya dipakai
 * ulang antar section, dan bentuk itu tidak pantas tampil di form editor — admin akan
 * mengira `keluargaInfo::nik` adalah nama field yang harus diketik ulang. Prefix
 * ditambahkan kembali di `buildFormVersion` (lihat `namaTersimpan`), jadi kedua
 * arah harus berubah bersamaan.
 *
 * Form manual tidak menyentuh jalur ini: isian yang tidak ber-prefix
 * dikembalikan utuh oleh `namaTanpaPrefix`.
 */
export async function ambilDefinisiVersi(formVersionId: string) {
  const versi = await db
    .select({
      id: formVersions.id,
      formId: formVersions.formId,
      version: formVersions.version,
      status: formVersions.status,
      publishedAt: formVersions.publishedAt,
    })
    .from(formVersions)
    .where(eq(formVersions.id, formVersionId))
    .limit(1)

  if (!versi[0]) {
    throw new KesalahanValidasi({
      ok: false,
      kode: 'VERSI_TIDAK_ADA',
      pesan: 'Form versi tidak ditemukan.',
    })
  }

  // `forms.kode` menentukan apakah nama field dikembalikan dalam bentuk
  // pendek. Form manual disimpan apa adanya, jadi bentuk pendek dan bentuk
  // tersimpan sama dan jalur ini tidak berpengaruh untuk form manual.
  const [form] = await db
    .select({ kode: forms.kode })
    .from(forms)
    .where(eq(forms.id, versi[0].formId))
    .limit(1)
  const bawaan = (form?.kode ?? null) !== null
  const namaUntukEditor = (nama: string): string =>
    bawaan ? namaTanpaPrefix(nama) : nama

  const [autofillRows, visibilitasRows] = await Promise.all([
    db
      .select()
      .from(formFieldAutofills)
      .where(eq(formFieldAutofills.formVersionId, formVersionId)),
    db
      .select()
      .from(formFieldVisibilityRules)
      .where(eq(formFieldVisibilityRules.formVersionId, formVersionId)),
  ])
  const rulesAutofill = autofillRows.map((r) => ({
    id: r.id,
    triggerFieldId: r.triggerFieldId,
    targetFieldId: r.targetFieldId,
    sumber: r.sumber as RuleAutofill['sumber'],
    kolom: r.kolom,
    transform: r.transform as RuleAutofill['transform'],
    mode: r.mode as RuleAutofill['mode'],
    aktif: r.aktif,
    urutan: r.urutan,
  }))
  const rulesVisibilitas = visibilitasRows.map((r) => ({
    id: r.id,
    targetType: r.targetType as RuleVisibilitas['targetType'],
    targetId: r.targetId,
    triggerFieldId: r.triggerFieldId,
    operator: r.operator as RuleVisibilitas['operator'],
    nilaiAcuan: r.nilaiAcuan as RuleVisibilitas['nilaiAcuan'],
    aktif: r.aktif,
    urutan: r.urutan,
  }))

  const sections = await db
    .select({
      id: formSections.id,
      formVersionId: formSections.formVersionId,
      nama: formSections.nama,
      deskripsi: formSections.deskripsi,
      urutan: formSections.urutan,
      aktif: formSections.aktif,
    })
    .from(formSections)
    .where(eq(formSections.formVersionId, formVersionId))

  // Versi tanpa section tidak punya field, jadi query field dan opsi dilewati
  // saja. `inArray` dengan daftar kosong justru tetap memindai tabel.
  if (sections.length === 0) {
    return { ...versi[0], sections: [], rulesAutofill, rulesVisibilitas }
  }

  const fieldRows = await db
    .select({
      id: formFields.id,
      sectionId: formFields.sectionId,
      nama: formFields.nama,
      label: formFields.label,
      tipe: formFields.tipe,
      optionSourceType: formFields.optionSourceType,
      optionSourceKey: formFields.optionSourceKey,
      deskripsi: formFields.deskripsi,
      placeholder: formFields.placeholder,
      wajib: formFields.wajib,
      urutan: formFields.urutan,
      jumlahKolom: formFields.jumlahKolom,
      aktif: formFields.aktif,
    })
    .from(formFields)
    .where(
      inArray(
        formFields.sectionId,
        sections.map((s) => s.id),
      ),
    )
    .orderBy(formFields.urutan)

  const fieldsBySection = new Map<string, typeof fieldRows>()
  for (const baris of fieldRows) {
    const list = fieldsBySection.get(baris.sectionId)
    if (list) list.push(baris)
    else fieldsBySection.set(baris.sectionId, [baris])
  }

  if (fieldRows.length === 0) {
    return {
      ...versi[0],
      rulesAutofill,
      rulesVisibilitas,
      sections: sections.map((section) => ({ ...section, fields: [] })),
    }
  }

  const opsiRows = await db
    .select({
      id: formFieldOptions.id,
      fieldId: formFieldOptions.fieldId,
      value: formFieldOptions.value,
      label: formFieldOptions.label,
      urutan: formFieldOptions.urutan,
      aktif: formFieldOptions.aktif,
    })
    .from(formFieldOptions)
    .where(
      inArray(
        formFieldOptions.fieldId,
        fieldRows.map((f) => f.id),
      ),
    )
    .orderBy(formFieldOptions.urutan)

  const opsiByField = new Map<string, OpsiDefinisiField[]>()
  for (const baris of opsiRows) {
    const list = opsiByField.get(baris.fieldId)
    if (list) list.push(baris)
    else opsiByField.set(baris.fieldId, [baris])
  }

  return {
    ...versi[0],
    rulesAutofill,
    rulesVisibilitas,
    sections: sections.map((section) => ({
      ...section,
      fields: (fieldsBySection.get(section.id) ?? []).map((field) => ({
        ...field,
        nama: namaUntukEditor(field.nama),
        opsi: opsiByField.get(field.id) ?? [],
      })),
    })),
  }
}
