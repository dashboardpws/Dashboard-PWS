import { eq } from 'drizzle-orm'
import { db } from '@/lib/server/db.server'
import { formVersions, forms } from '@/lib/schema/schema'
import { parseFormDefinition } from '@/lib/form-builder/form-schema'
import { KesalahanValidasi } from './form-version.server'
import { namaTanpaPrefix } from '@/lib/form-builder/kode-bawaan'

/** Satu pilihan jawaban milik satu field. */
export interface OpsiDefinisiField {
  id: string
  fieldId: string
  value: string
  label: string
  urutan: number
  aktif: boolean
}

/**
 * Versi form beserta struktur editor yang sudah diparsing dari satu dokumen.
 *
 * Nama field form bawaan tetap dikembalikan tanpa prefix penyimpanan. Prefix
 * ditambahkan saat Build agar kode lama yang memetakan section tetap stabil.
 */
export async function ambilDefinisiVersi(formVersionId: string) {
  const [versi] = await db
    .select({
      id: formVersions.id,
      formId: formVersions.formId,
      version: formVersions.version,
      status: formVersions.status,
      publishedAt: formVersions.publishedAt,
      schema: formVersions.schema,
    })
    .from(formVersions)
    .where(eq(formVersions.id, formVersionId))
    .limit(1)

  if (!versi) {
    throw new KesalahanValidasi({
      ok: false,
      kode: 'VERSI_TIDAK_ADA',
      pesan: 'Form versi tidak ditemukan.',
    })
  }

  const [form] = await db
    .select({ kode: forms.kode })
    .from(forms)
    .where(eq(forms.id, versi.formId))
    .limit(1)
  const bawaan = form?.kode !== null && form?.kode !== undefined
  const schema = parseFormDefinition(versi.schema)

  if (schema.version !== versi.version) {
    throw new Error(
      `Schema form versi ${versi.version} tidak cocok dengan nomor versi di dokumen (${schema.version}).`,
    )
  }

  const fields = schema.sections.flatMap((section) =>
    section.fields.map((field) => ({
      id: field.id,
      sectionId: section.id,
      nama: bawaan ? namaTanpaPrefix(field.name) : field.name,
      label: field.label,
      tipe: field.type,
      optionSourceType: field.optionSourceType,
      optionSourceKey: field.optionSourceKey,
      deskripsi: field.description,
      placeholder: field.placeholder,
      wajib: field.required,
      urutan: field.order,
      jumlahKolom: field.columns,
      aktif: field.active,
      opsi: field.options.map((option) => ({
        id: option.id,
        fieldId: field.id,
        value: option.value,
        label: option.label,
        urutan: option.order,
        aktif: option.active,
      })),
    })),
  )

  const rulesAutofill = schema.sections.flatMap((section) =>
    section.fields.flatMap((field) => field.autofill),
  )
  const rulesVisibilitas = schema.sections.flatMap((section) => [
    ...section.visibilityRules,
    ...section.fields.flatMap((field) => field.visibilityRules),
  ])

  return {
    id: versi.id,
    formId: versi.formId,
    version: versi.version,
    status: versi.status,
    publishedAt: versi.publishedAt,
    sections: schema.sections.map((section) => ({
      id: section.id,
      formVersionId: versi.id,
      nama: section.name,
      deskripsi: section.description,
      urutan: section.order,
      aktif: section.active,
      fields: fields.filter((field) => field.sectionId === section.id),
    })),
    rulesAutofill,
    rulesVisibilitas,
  }
}
