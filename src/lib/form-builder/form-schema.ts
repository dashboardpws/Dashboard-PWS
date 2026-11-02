import { z } from 'zod'
import { SEMUA_TIPE_FIELD } from '@/lib/service/form-builder/validasi'

const idSchema = z.string().uuid()

const nilaiJsonSchema = z.json()

export const aturanAutofillSchema = z.object({
  id: idSchema,
  triggerFieldId: idSchema,
  targetFieldId: idSchema,
  sumber: z.enum(['warga', 'anggota', 'riwayat']),
  kolom: z.string().min(1),
  transform: z.enum(['teks', 'nik', 'tanggal', 'opsi', 'angka']),
  mode: z.enum(['isi_kosong', 'timpa']),
  aktif: z.boolean(),
  urutan: z.number().int().nonnegative(),
})

export const aturanVisibilitasSchema = z.object({
  id: idSchema,
  targetType: z.enum(['field', 'section']),
  targetId: idSchema,
  triggerFieldId: idSchema,
  operator: z.enum(['eq', 'neq', 'in', 'nin', 'kosong', 'tidak_kosong']),
  nilaiAcuan: nilaiJsonSchema,
  aktif: z.boolean(),
  urutan: z.number().int().nonnegative(),
})

/**
 * Kelompok layout di dalam satu section.
 *
 * Section sasaran dan generik mengelompokkan field lewat `layoutGroup` pada field
 * dan daftar ini pada section. Label dan urutan kelompok sengaja eksplisit, bukan
 * disimpulkan dari nama field: form kunjungan rumah sudah punya field bernama
 * sama di beberapa section, jadi konvensi nama tidak cukup aman.
 */
export const layoutGroupSchema = z.object({
  key: z.string().min(1),
  label: z.string(),
  order: z.number().int().nonnegative(),
})

const opsiSchema = z.object({
  id: idSchema,
  value: z.string(),
  label: z.string(),
  order: z.number().int().nonnegative(),
  active: z.boolean(),
})

const fieldSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  label: z.string(),
  type: z.enum([...SEMUA_TIPE_FIELD]),
  required: z.boolean(),
  active: z.boolean(),
  order: z.number().int().nonnegative(),
  description: z.string().nullable(),
  placeholder: z.string().nullable(),
  columns: z.number().int().positive().nullable(),
  /**
   * Kunci kelompok layout di dalam section. Null/absen = tidak berkelompok.
   * Hanya dipakai renderer generik; section bawaan tetap memakai widget sendiri.
   */
  layoutGroup: z.string().nullable().optional(),
  optionSourceType: z.string().nullable(),
  optionSourceKey: z.string().nullable(),
  options: z.array(opsiSchema),
  autofill: z.array(aturanAutofillSchema),
  visibilityRules: z.array(aturanVisibilitasSchema),
})

const sectionSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  label: z.string(),
  description: z.string().nullable(),
  order: z.number().int().nonnegative(),
  active: z.boolean(),
  /**
   * Peran section di form kunjungan rumah. Absen = section lama yang belum
   * punya metadata; pembaca menyimpulkannya dari nama section bawaan.
   */
  sectionKind: z.string().min(1).nullable().optional(),
  layoutGroups: z.array(layoutGroupSchema).optional(),
  fields: z.array(fieldSchema),
  visibilityRules: z.array(aturanVisibilitasSchema),
})

export const formDefinitionSchema = z
  .object({
    version: z.number().int().positive(),
    sections: z.array(sectionSchema),
  })
  .superRefine((schema, ctx) => {
    const sectionIds = new Set<string>()
    const fieldIds = new Set<string>()

    schema.sections.forEach((section, sectionIndex) => {
      if (sectionIds.has(section.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['sections', sectionIndex, 'id'],
          message: 'ID section harus unik di dalam satu versi form.',
        })
      }
      sectionIds.add(section.id)

      section.fields.forEach((field, fieldIndex) => {
        if (fieldIds.has(field.id)) {
          ctx.addIssue({
            code: 'custom',
            path: ['sections', sectionIndex, 'fields', fieldIndex, 'id'],
            message: 'ID field harus unik di dalam satu versi form.',
          })
        }
        fieldIds.add(field.id)
      })
    })

    schema.sections.forEach((section, sectionIndex) => {
      section.visibilityRules.forEach((rule, ruleIndex) => {
        if (
          !fieldIds.has(rule.triggerFieldId) ||
          rule.targetType !== 'section' ||
          rule.targetId !== section.id
        ) {
          ctx.addIssue({
            code: 'custom',
            path: ['sections', sectionIndex, 'visibilityRules', ruleIndex],
            message:
              'Aturan section merujuk section atau field yang tidak ada.',
          })
        }
      })

      section.fields.forEach((field, fieldIndex) => {
        field.autofill.forEach((rule, ruleIndex) => {
          if (
            !fieldIds.has(rule.triggerFieldId) ||
            rule.targetFieldId !== field.id
          ) {
            ctx.addIssue({
              code: 'custom',
              path: [
                'sections',
                sectionIndex,
                'fields',
                fieldIndex,
                'autofill',
                ruleIndex,
              ],
              message: 'Aturan autofill merujuk field yang tidak ada.',
            })
          }
        })

        field.visibilityRules.forEach((rule, ruleIndex) => {
          if (
            !fieldIds.has(rule.triggerFieldId) ||
            rule.targetType !== 'field' ||
            rule.targetId !== field.id
          ) {
            ctx.addIssue({
              code: 'custom',
              path: [
                'sections',
                sectionIndex,
                'fields',
                fieldIndex,
                'visibilityRules',
                ruleIndex,
              ],
              message: 'Aturan field merujuk field yang tidak ada.',
            })
          }
        })
      })
    })
  })

export type FormDefinition = z.infer<typeof formDefinitionSchema>
export type FormSectionDefinition = FormDefinition['sections'][number]
export type FormFieldDefinition = FormSectionDefinition['fields'][number]
export type FormOptionDefinition = FormFieldDefinition['options'][number]

export function parseFormDefinition(value: unknown): FormDefinition {
  return formDefinitionSchema.parse(value)
}
