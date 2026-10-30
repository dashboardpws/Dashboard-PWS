import { SUMBER_SUGGEST } from '@/lib/service/form-builder/sumber-opsi'
import type {
  BuildFormVersionInput,
  DraftFormDocument,
} from '@/components/kelola/builder/types'

/**
 * Normalisasi payload build dari dokumen draft menjadi bentuk yang dikirim ke server.
 *
 * Logika ini dipindahkan dari `use-form-builder-draft.buildForm` agar bisa diuji
 * sebagai fungsi murni tanpa hook React. Perilaku harus identik persis dengan
 * implementasi sebelumnya.
 */
export function normalisasiPayloadBuild(
  dokumen: DraftFormDocument,
): BuildFormVersionInput {
  const sectionsPayload = dokumen.sections.map((s) => ({
    clientId: s.clientId,
    id: s.id,
    nama: s.nama.trim(),
    deskripsi: s.deskripsi?.trim() ?? null,
    aktif: s.aktif,
  }))

  const fieldsPayload = dokumen.fields.map((f) => ({
    clientId: f.clientId,
    id: f.id,
    sectionClientId: f.sectionClientId,
    nama: f.nama.trim(),
    label: f.label.trim(),
    tipe: f.tipe,
    wajib: f.wajib,
    aktif: f.aktif,
    placeholder: f.placeholder?.trim() ?? null,
    deskripsi: f.deskripsi?.trim() ?? null,
    jumlahKolom: f.jumlahKolom,
    optionSourceType: f.optionSourceType,
    optionSourceKey:
      f.optionSourceType === SUMBER_SUGGEST ? null : f.optionSourceKey,
    opsi: f.opsi.map((o, idx) => ({
      value: o.value.trim(),
      label: o.label.trim() || o.value.trim(),
      urutan: idx,
      aktif: o.aktif,
    })),
  }))

  return {
    formVersionId: dokumen.formVersionId,
    sections: sectionsPayload,
    fields: fieldsPayload,
    rulesAutofill: dokumen.rulesAutofill ?? [],
    rulesVisibilitas: dokumen.rulesVisibilitas ?? [],
    actorId: null,
  }
}
