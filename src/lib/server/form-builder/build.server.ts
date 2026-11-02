import { eq } from 'drizzle-orm'
import { db } from '@/lib/server/db.server'
import { formVersions, forms } from '@/lib/schema/schema'
import {
  formDefinitionSchema,
  parseFormDefinition,
} from '@/lib/form-builder/form-schema'
import type { FormDefinition } from '@/lib/form-builder/form-schema'
import { validasiFieldPenuh } from '@/lib/service/form-builder/validasi'
import type {
  HasilValidasi,
  TipeField,
} from '@/lib/service/form-builder/validasi'
import { KesalahanValidasi, assertVersiBisaDiubah } from './form-version.server'
import {
  aturanForm,
  namaDenganPrefix,
  namaTanpaPrefix,
} from '@/lib/form-builder/kode-bawaan'
import { catatAudit } from './audit.server'
import type {
  BuildFormVersionInput,
  BuildFormVersionResult,
} from '@/components/kelola/builder/types'

function pastikan(hasil: HasilValidasi): void {
  if (!hasil.ok) throw new KesalahanValidasi(hasil)
}

type SectionInput = BuildFormVersionInput['sections'][number]
type FieldInput = BuildFormVersionInput['fields'][number]

type ExistingSection = {
  id: string
  nama: string
  urutan: number
  aktif: boolean
}

type ExistingField = {
  id: string
  sectionId: string
  nama: string
  tipe: TipeField
  optionSourceKey: string | null
}

/** Pesan untuk field yang sudah punya isian, dipertahankan untuk utilitas murni. */
export function pesanFieldTerpakai(
  dipakai: { fieldId: string; total: number }[],
  namaField: Map<string, string>,
): string {
  const total = dipakai.reduce((n, d) => n + d.total, 0)
  const contoh = dipakai
    .slice(0, 3)
    .map((d) => `"${namaField.get(d.fieldId) ?? d.fieldId}" (${d.total} isian)`)
    .join(', ')
  const sisa =
    dipakai.length > 3 ? `, dan ${dipakai.length - 3} field lainnya` : ''
  return (
    `Field ${contoh}${sisa} sudah punya ${total} isian, jadi tidak bisa dihapus. ` +
    'Nonaktifkan fieldnya lewat ikon mata, atau hapus isiannya dulu.'
  )
}

function validasiSections(sections: SectionInput[]): HasilValidasi {
  const namaMap = new Map<string, string>()
  for (const section of sections) {
    const nama = section.nama.trim()
    if (!nama) {
      return {
        ok: false,
        kode: 'VERSI_TIDAK_ADA',
        pesan: `Section ${section.clientId}: nama wajib diisi.`,
      }
    }
    const pemilik = namaMap.get(nama)
    if (pemilik && pemilik !== section.clientId) {
      return {
        ok: false,
        kode: 'NAMA_FIELD_BENTARAK',
        pesan: `Nama section "${nama}" duplikat.`,
      }
    }
    namaMap.set(nama, section.clientId)
  }
  return { ok: true }
}

function validasiFields(
  fields: FieldInput[],
  sections: SectionInput[],
  existingFieldIds: Set<string>,
  bawaan: boolean,
): HasilValidasi {
  const fieldsBySection = new Map<string, FieldInput[]>()
  for (const field of fields) {
    const list = fieldsBySection.get(field.sectionClientId) ?? []
    list.push(field)
    fieldsBySection.set(field.sectionClientId, list)
  }

  for (const [sectionClientId, sectionFields] of fieldsBySection) {
    const section = sections.find((item) => item.clientId === sectionClientId)
    if (!section) {
      return {
        ok: false,
        kode: 'VERSI_TIDAK_ADA',
        pesan: `Section ${sectionClientId} tidak ditemukan untuk field.`,
      }
    }

    const result = validasiFieldPenuh({
      fields: sectionFields.map((field) => ({
        nama: field.nama,
        label: field.label,
        tipe: field.tipe,
        optionSourceType: field.optionSourceType,
        optionSourceKey: field.optionSourceKey,
        jumlahKolom: field.jumlahKolom,
        opsi: field.opsi.map((option) => ({
          value: option.value,
          aktif: option.aktif,
        })),
        hapus: false,
        fieldBawaan:
          bawaan && field.id !== null && existingFieldIds.has(field.id),
      })),
      normalisasiNama: bawaan ? namaTanpaPrefix : undefined,
    })
    if (!result.ok) {
      return {
        ok: false,
        kode: result.kode,
        pesan: `Section ${section.nama}: ${result.pesan}`,
      }
    }
  }
  return { ok: true }
}

function bentukSchema(
  version: number,
  sections: SectionInput[],
  fields: FieldInput[],
  rulesAutofill: BuildFormVersionInput['rulesAutofill'],
  rulesVisibilitas: BuildFormVersionInput['rulesVisibilitas'],
  bawaan: boolean,
  oldSchema: FormDefinition,
): FormDefinition {
  const sectionIdByClientId = new Map(
    sections.map((section) => [
      section.clientId,
      section.id ?? section.clientId,
    ]),
  )
  const fieldIdByClientId = new Map(
    fields.map((field) => [field.clientId, field.id ?? field.clientId]),
  )
  /**
   * Metadata yang tidak punya kontrol di editor tetap dipertahankan.
   *
   * `sectionKind`, `layoutGroups`, dan `layoutGroup` menentukan renderer dan
   * namespace isian. Kalau build menulis ulang schema tanpa tiga hal ini,
   * setiap kali admin menyimpan draft section generik akan berubah jadi section
   * biasa yang tidak dikenali. Untuk section/field baru nilainya null, dan
   * pembaca menyimpulkannya sebagai generik.
   */
  const sectionLamaById = new Map(
    oldSchema.sections.map((section) => [section.id, section]),
  )
  const fieldLamaById = new Map(
    oldSchema.sections.flatMap((section) =>
      section.fields.map((field) => [field.id, field] as const),
    ),
  )

  const autofill = rulesAutofill.map((rule, urutan) => {
    const triggerFieldId = fieldIdByClientId.get(rule.triggerFieldId)
    const targetFieldId = fieldIdByClientId.get(rule.targetFieldId)
    if (!triggerFieldId || !targetFieldId) {
      throw new KesalahanValidasi({
        ok: false,
        kode: 'FIELD_TIDAK_ADA',
        pesan: 'Aturan autofill merujuk field yang tidak ada di draft.',
      })
    }
    return { ...rule, triggerFieldId, targetFieldId, urutan }
  })
  const visibilitas = rulesVisibilitas.map((rule, urutan) => {
    const triggerFieldId = fieldIdByClientId.get(rule.triggerFieldId)
    const targetId =
      rule.targetType === 'field'
        ? fieldIdByClientId.get(rule.targetId)
        : sectionIdByClientId.get(rule.targetId)
    if (!triggerFieldId || !targetId) {
      throw new KesalahanValidasi({
        ok: false,
        kode: 'FIELD_TIDAK_ADA',
        pesan: 'Aturan visibilitas merujuk field atau section yang tidak ada.',
      })
    }
    return { ...rule, triggerFieldId, targetId, urutan }
  })

  const sectionDefinitions = sections.map((section, sectionOrder) => {
    const sectionId = sectionIdByClientId.get(section.clientId)!
    const lama = sectionLamaById.get(sectionId)
    const fieldsInSection = fields.filter(
      (field) => field.sectionClientId === section.clientId,
    )

    return {
      id: sectionId,
      name: section.nama.trim(),
      label: lama?.label || section.nama.trim(),
      description: section.deskripsi?.trim() ?? null,
      order: sectionOrder,
      active: section.aktif,
      sectionKind: lama?.sectionKind ?? null,
      layoutGroups: lama?.layoutGroups ?? [],
      visibilityRules: visibilitas.filter(
        (rule) => rule.targetType === 'section' && rule.targetId === sectionId,
      ),
      fields: fieldsInSection.map((field, fieldOrder) => {
        const fieldId = fieldIdByClientId.get(field.clientId)!
        const nama = field.nama.trim()
        return {
          id: fieldId,
          name: bawaan
            ? namaDenganPrefix(section.nama.trim(), namaTanpaPrefix(nama))
            : nama,
          label: field.label.trim(),
          type: field.tipe,
          required: field.wajib,
          active: field.aktif,
          order: fieldOrder,
          description: field.deskripsi?.trim() ?? null,
          placeholder: field.placeholder?.trim() ?? null,
          columns:
            fieldLamaById.get(fieldId)?.columns ??
            (field.tipe === 'group' ? field.jumlahKolom : null),
          layoutGroup: fieldLamaById.get(fieldId)?.layoutGroup ?? null,
          optionSourceType: field.optionSourceType,
          optionSourceKey: field.optionSourceKey,
          options: field.opsi.map((option, optionOrder) => ({
            id: crypto.randomUUID(),
            value: option.value.trim(),
            label: option.label.trim() || option.value.trim(),
            order: optionOrder,
            active: option.aktif,
          })),
          autofill: autofill.filter((rule) => rule.targetFieldId === fieldId),
          visibilityRules: visibilitas.filter(
            (rule) => rule.targetType === 'field' && rule.targetId === fieldId,
          ),
        }
      }),
    }
  })

  return formDefinitionSchema.parse({ version, sections: sectionDefinitions })
}

/**
 * Build memvalidasi satu payload lengkap lebih dulu, lalu mengganti satu dokumen
 * JSONB di dalam transaksi. ID section dan field yang sudah ada dipertahankan;
 * field baru memakai clientId UUID sebagai ID permanen.
 */
export async function buildFormVersion(
  input: BuildFormVersionInput,
): Promise<BuildFormVersionResult> {
  const { formVersionId, actorId } = input
  await assertVersiBisaDiubah(formVersionId)

  const [versi] = await db
    .select({
      version: formVersions.version,
      schema: formVersions.schema,
      kode: forms.kode,
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

  const oldSchema = parseFormDefinition(versi.schema)
  const oldSections: ExistingSection[] = oldSchema.sections.map((section) => ({
    id: section.id,
    nama: section.name,
    urutan: section.order,
    aktif: section.active,
  }))
  const oldFields: ExistingField[] = oldSchema.sections.flatMap((section) =>
    section.fields.map((field) => ({
      id: field.id,
      sectionId: section.id,
      nama: field.name,
      tipe: field.type,
      optionSourceKey: field.optionSourceKey,
    })),
  )
  const sections = input.sections
  const fields = input.fields
  const incomingSectionIds = new Set(
    sections.map((section) => section.id ?? section.clientId),
  )
  const incomingFieldIds = new Set(
    fields.map((field) => field.id ?? field.clientId),
  )
  const sectionClientIds = new Set(sections.map((section) => section.clientId))
  const fieldClientIds = new Set(fields.map((field) => field.clientId))
  const bawaan = versi.kode !== null

  const knownSectionIds = new Set(oldSections.map((section) => section.id))
  const knownFieldIds = new Set(oldFields.map((field) => field.id))
  if (
    sections.some(
      (section) => section.id !== null && !knownSectionIds.has(section.id),
    ) ||
    fields.some((field) => field.id !== null && !knownFieldIds.has(field.id))
  ) {
    throw new KesalahanValidasi({
      ok: false,
      kode: 'NILAI_TIDAK_COCOK',
      pesan:
        'ID section atau field tidak berasal dari versi form yang sedang disunting.',
    })
  }

  pastikan(validasiSections(sections))
  pastikan(
    validasiFields(
      fields,
      sections,
      new Set(oldFields.map((f) => f.id)),
      bawaan,
    ),
  )

  const keysAutofill = new Set<string>()
  for (const rule of input.rulesAutofill) {
    const key = JSON.stringify([
      rule.triggerFieldId,
      rule.targetFieldId,
      rule.sumber,
      rule.kolom,
    ])
    if (keysAutofill.has(key)) {
      throw new KesalahanValidasi({
        ok: false,
        kode: 'ATURAN_AUTOFILL_DUPLIKAT',
        pesan: 'Aturan autofill yang sama tidak boleh didaftarkan dua kali.',
      })
    }
    keysAutofill.add(key)
    if (
      !fieldClientIds.has(rule.triggerFieldId) ||
      !fieldClientIds.has(rule.targetFieldId)
    ) {
      throw new KesalahanValidasi({
        ok: false,
        kode: 'FIELD_TIDAK_ADA',
        pesan: 'Aturan autofill merujuk field yang tidak ada di draft.',
      })
    }
  }
  for (const rule of input.rulesVisibilitas) {
    const targetAda =
      rule.targetType === 'field'
        ? fieldClientIds.has(rule.targetId)
        : sectionClientIds.has(rule.targetId)
    if (!fieldClientIds.has(rule.triggerFieldId) || !targetAda) {
      throw new KesalahanValidasi({
        ok: false,
        kode: 'FIELD_TIDAK_ADA',
        pesan: 'Aturan visibilitas merujuk field atau section yang tidak ada.',
      })
    }
  }

  const sectionIdByClientId = new Map(
    sections.map((section) => [
      section.clientId,
      section.id ?? section.clientId,
    ]),
  )
  pastikan(
    aturanForm(versi.kode).validasiDraft({
      sections: sections.map((section) => ({
        id: section.id ?? section.clientId,
        nama: section.nama,
        sectionKind:
          oldSchema.sections.find((old) => old.id === section.id)
            ?.sectionKind ?? (section.id ? null : 'form_generik'),
      })),
      fields: fields.map((field) => ({
        id: field.id ?? field.clientId,
        sectionId: sectionIdByClientId.get(field.sectionClientId) ?? null,
        nama: field.nama,
        tipe: field.tipe,
        optionSourceType: field.optionSourceType,
        optionSourceKey: field.optionSourceKey,
      })),
      sectionsLama: oldSections,
      fieldsLama: oldFields,
    }),
  )

  const schema = bentukSchema(
    versi.version,
    sections,
    fields,
    input.rulesAutofill,
    input.rulesVisibilitas,
    bawaan,
    oldSchema,
  )
  const validatedSchema = formDefinitionSchema.safeParse(schema)
  if (!validatedSchema.success) {
    throw new KesalahanValidasi({
      ok: false,
      kode: 'NILAI_TIDAK_COCOK',
      pesan: `Definisi form tidak valid: ${validatedSchema.error.issues[0]?.message ?? 'periksa struktur field dan aturan.'}`,
    })
  }

  const removedSectionIds = oldSections.filter(
    (section) => !incomingSectionIds.has(section.id),
  )
  const removedFieldIds = oldFields.filter(
    (field) => !incomingFieldIds.has(field.id),
  )

  await db.transaction(async (tx) => {
    await assertVersiBisaDiubah(formVersionId, tx)
    await tx
      .update(formVersions)
      .set({ schema: validatedSchema.data, updatedAt: new Date() })
      .where(eq(formVersions.id, formVersionId))
  })

  const result = {
    jumlahSection: sections.length,
    jumlahField: fields.length,
    jumlahDihapus: removedSectionIds.length + removedFieldIds.length,
  }
  await catatAudit({
    userId: actorId ?? null,
    aksi: 'update',
    entitas: 'form_versions',
    entitasId: formVersionId,
    sesudah: { formVersionId, ...result },
  })
  return result
}
