import { db } from '@/lib/server/db.server'
import { formFieldAutofills } from '@/lib/schema/schema'

export async function seedKrAutofillRules(
  formVersionId: string,
  fieldIds: Partial<
    Record<
      'nik' | 'namaKK' | 'alamat' | 'rt' | 'rw' | 'kelurahan' | 'kecamatan',
      string
    >
  >,
) {
  const triggerFieldId = fieldIds.nik
  if (!triggerFieldId) {
    throw new Error('ID field NIK Form KR wajib tersedia untuk seed autofill.')
  }

  const kolomWarga = [
    {
      targetFieldId: fieldIds.nik,
      sumber: 'warga',
      kolom: 'nik',
      transform: 'nik',
    },
    {
      targetFieldId: fieldIds.namaKK,
      sumber: 'warga',
      kolom: 'namaKk',
      transform: 'teks',
    },
    {
      targetFieldId: fieldIds.alamat,
      sumber: 'warga',
      kolom: 'alamat',
      transform: 'teks',
    },
    {
      targetFieldId: fieldIds.rt,
      sumber: 'warga',
      kolom: 'rt',
      transform: 'teks',
    },
    {
      targetFieldId: fieldIds.rw,
      sumber: 'warga',
      kolom: 'rw',
      transform: 'teks',
    },
    {
      targetFieldId: fieldIds.kelurahan,
      sumber: 'warga',
      kolom: 'kelurahan',
      transform: 'teks',
    },
    {
      targetFieldId: fieldIds.kecamatan,
      sumber: 'warga',
      kolom: 'kecamatan',
      transform: 'teks',
    },
  ]
  const rules = kolomWarga
    .filter((rule) => typeof rule.targetFieldId === 'string')
    .map((rule) => ({ ...rule, targetFieldId: rule.targetFieldId! }))

  for (const [index, r] of rules.entries()) {
    await db.insert(formFieldAutofills).values({
      formVersionId,
      // Pemilihan warga dipicu dari field NIK pada form KR.
      triggerFieldId,
      targetFieldId: r.targetFieldId,
      sumber: r.sumber,
      kolom: r.kolom,
      transform: r.transform,
      mode: 'isi_kosong',
      urutan: index,
      aktif: true,
    })
  }
}
