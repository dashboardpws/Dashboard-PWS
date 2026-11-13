/**
 * Adapter dari draft editor ke bentuk yang bisa dirender `DynamicField`.
 *
 * Pratinjau membaca DRAFT yang sedang diedit, bukan baris database. Jadi bentuk
 * pratinjaunya harus mengikuti bentuk `SectionRuntime`/`FieldRuntime` yang
 * dipakai halaman isi, tanpa memanggil server dan tanpa menyentuh schema.
 *
 * Tipe diimport type-only dari `form-runtime.server.ts` supaya modul drizzle
 * tidak ikut terbawa ke bundle klien.
 *
 * `opsiDinamis` diisi untuk sumber yang bisa di-resolve tanpa database — yaitu
 * enum (agama, jenis kelamin, dst.) dan daftar saran. Sumber yang harus query
 * (petugas, fasilitas, distinct data warga) TIDAK bisa di-resolve di browser,
 * jadi pratinjau menandainya dengan `sumberOpsiLabel` dan membiarkan
 * `opsiDinamis` null: lebih jujur daripada menampilkan daftar tebakan.
 *
 * Blok meta pencatatan (petugas, tanggal, warga) tidak ikut, karena tidak ada
 * di dokumen draft.
 */
import type {
  FieldRuntime,
  OpsiDinamisRuntime,
  OpsiRuntime,
  SectionRuntime,
} from '@/lib/server/survey/form-runtime.server'
import type {
  DraftField,
  DraftFormDocument,
  DraftOpsi,
} from '@/components/kelola/builder/types'
import {
  SUMBER_CARI_WARGA,
  SUMBER_SUGGEST,
  cariSumber,
  nilaiEnum,
} from '@/lib/service/form-builder/sumber-opsi'

export interface DefinisiPratinjau {
  sections: SectionRuntime[]
  /**
   * Field yang section-nya tidak ada di draft. Tidak dirender sebagai section
   * (tidak punya tempat), tapi dikembalikan supaya pratinjau bisa
   * menampilkannya terpisah dan admin tahu field itu tidak akan tayang.
   */
  fieldYatim: FieldRuntime[]
}

function opsiKeRuntime(opsi: readonly DraftOpsi[]): OpsiRuntime[] {
  return opsi.map((o, urutan) => ({
    value: o.value.trim(),
    label: o.label.trim() || o.value.trim(),
    urutan,
    aktif: o.aktif,
  }))
}

/**
 * Pilihan jawaban yang bisa ditampilkan tanpa menyentuh database.
 *
 * Null kalau sumbernya butuh query server — lihat catatan di atas.
 */
function opsiLokal(field: DraftField): OpsiDinamisRuntime[] | null {
  if (!field.optionSourceType) return null

  if (field.optionSourceType === SUMBER_SUGGEST) {
    return opsiKeRuntime(field.opsi).map((o) => ({
      value: o.value,
      label: o.label ?? o.value,
    }))
  }

  const source = cariSumber(field.optionSourceType, field.optionSourceKey)
  if (!source || source.perluServer) return null

  const nilai = nilaiEnum(source.key)
  if (!nilai) return null

  return nilai.map((v, i) => ({ value: v, label: v, urutan: i }))
}

/**
 * Satu field draft → `FieldRuntime`.
 *
 * `id` memakai `clientId` supaya tetap unik walau `nama` kosong, dan anchor
 * `fieldAnchorId` yang dipakai `DynamicField` tetap menunjuk satu tempat.
 * `nama` tidak pernah ditampilkan halaman isi, jadi tidak dikarang di sini.
 */
export function fieldKeRuntime(
  field: DraftField,
  urutan: number,
): FieldRuntime {
  return {
    id: field.clientId,
    nama: field.nama.trim(),
    label: field.label.trim() || field.nama.trim() || '(tanpa label)',
    tipe: field.tipe,
    deskripsi: field.deskripsi?.trim() ?? null,
    placeholder: field.placeholder?.trim() ?? null,
    wajib: field.wajib,
    urutan,
    jumlahKolom: field.jumlahKolom,
    aktif: field.aktif,
    opsi: opsiKeRuntime(field.opsi),
    opsiDinamis: opsiLokal(field),
    // Sumber valid yang butuh query memang belum diambil, bukan salah konfigurasi.
    // Hanya type/key di luar katalog yang ditandai tidak dikenali.
    sumberOpsiTidakDikenali: Boolean(
      field.optionSourceType &&
      !cariSumber(field.optionSourceType, field.optionSourceKey),
    ),
    sumberOpsiLabel:
      cariSumber(field.optionSourceType, field.optionSourceKey)?.label ?? null,
    saran:
      field.optionSourceType === SUMBER_SUGGEST
        ? opsiKeRuntime(field.opsi).map((o) => o.label ?? o.value)
        : [],
    cariWarga:
      field.optionSourceType === SUMBER_CARI_WARGA
        ? (cariSumber(field.optionSourceType, field.optionSourceKey)?.kolom ??
          null)
        : null,
  }
}

/**
 * Susun definisi pratinjau dari dokumen draft.
 *
 * Section dan field nonaktif dibuang, sama seperti `muatDefinisiRuntime` di
 * service server: yang nonaktif memang tidak akan tampil saat diisi.
 */
export function draftKeRuntime(document: DraftFormDocument): DefinisiPratinjau {
  const sectionsAktif = document.sections.filter((s) => s.aktif)
  const idsSectionAktif = new Set(sectionsAktif.map((s) => s.clientId))
  const idsSectionAda = new Set(document.sections.map((s) => s.clientId))

  const fieldsAktif = document.fields.filter(
    (f) => f.aktif && idsSectionAktif.has(f.sectionClientId),
  )

  const sections: SectionRuntime[] = sectionsAktif.map((s, urutan) => ({
    id: s.clientId,
    nama: s.nama.trim() || '(section tanpa nama)',
    deskripsi: s.deskripsi?.trim() ?? null,
    urutan,
    fields: fieldsAktif
      .filter((f) => f.sectionClientId === s.clientId)
      .map((f, i) => fieldKeRuntime(f, i)),
  }))

  const fieldYatim = document.fields
    .filter((f) => f.aktif && !idsSectionAda.has(f.sectionClientId))
    .map((f, urutan) => fieldKeRuntime(f, urutan))

  return { sections, fieldYatim }
}
