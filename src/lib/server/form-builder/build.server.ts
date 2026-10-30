import { count, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/server/db.server'
import {
  formFields,
  formFieldAutofills,
  formFieldOptions,
  formFieldVisibilityRules,
  formSections,
  formVersions,
  forms,
  surveyEntries,
} from '@/lib/schema/schema'
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
import { sisipkanOpsi } from './opsi.server'
import type { OpsiInput } from './opsi.server'
import type {
  BuildFormVersionInput,
  BuildFormVersionResult,
} from '@/components/kelola/builder/types'

function pastikan(hasil: HasilValidasi): void {
  if (!hasil.ok) throw new KesalahanValidasi(hasil)
}

type Db = typeof db
type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0]
type Executor = Db | DbTx

interface SectionInput {
  clientId: string
  id: string | null
  nama: string
  deskripsi: string | null
  aktif: boolean
}

interface FieldInput {
  clientId: string
  id: string | null
  sectionClientId: string
  nama: string
  label: string
  tipe: TipeField
  wajib: boolean
  aktif: boolean
  placeholder: string | null
  deskripsi: string | null
  jumlahKolom: number | null
  /**
   * Sumber pilihan jawaban dari data yang sudah ada. null = admin mengetik
   * sendiri pilihannya di `opsi`. Katalog `sumber-opsi.ts` yang menentukan nilai
   * mana yang sah; `validasiFieldPenuh` menolak yang tidak dikenal.
   */
  optionSourceType: string | null
  optionSourceKey: string | null
  opsi: OpsiInput[]
}

/**
 * `forms.kode` untuk form pemilik sebuah versi.
 *
 * Yang menentukan apakah draft ini boleh diubah bentuknya atau tidak. `null`
 * berarti form manual: seluruh strukturnya bebas, jadi penjaga bawaan dilewati.
 */
async function ambilKodeFormVersi(
  executor: Executor,
  formVersionId: string,
): Promise<string | null> {
  const [baris] = await executor
    .select({ kode: forms.kode })
    .from(formVersions)
    .innerJoin(forms, eq(forms.id, formVersions.formId))
    .where(eq(formVersions.id, formVersionId))
    .limit(1)
  return baris?.kode ?? null
}

/** Baris `form_sections` versi ini, seperlunya untuk deciding upsert vs delete. */
type ExistingSection = {
  id: string
  nama: string
  urutan: number
  aktif: boolean
}

/** Baris `form_fields` versi ini, seperlunya untuk deciding upsert vs delete. */
type ExistingField = {
  id: string
  sectionId: string
  nama: string
  optionSourceKey: string | null
}

async function loadExisting(
  executor: Executor,
  formVersionId: string,
): Promise<{
  existingSections: ExistingSection[]
  existingFields: ExistingField[]
}> {
  const existingSections = await executor
    .select({
      id: formSections.id,
      nama: formSections.nama,
      urutan: formSections.urutan,
      aktif: formSections.aktif,
    })
    .from(formSections)
    .where(eq(formSections.formVersionId, formVersionId))

  const existingFields = await executor
    .select({
      id: formFields.id,
      sectionId: formFields.sectionId,
      nama: formFields.nama,
      optionSourceKey: formFields.optionSourceKey,
    })
    .from(formFields)
    .where(eq(formFields.formVersionId, formVersionId))

  return { existingSections, existingFields }
}

function validateAllSections(sections: SectionInput[]): HasilValidasi {
  // Duplikat dicek global dalam payload (termasuk rename), bukan hanya section baru.
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

/**
 * Bentuk nama yang divalidasi dan apakah form ini bawaan, digabung satu objek.
 *
 * Dua parameter opsional yang selalu berpasangan mudah terbalik, dan salah urutan
 * tidak menghasilkan error — hanya validasi yang salah tempat.
 */
interface OpsiValidasiField {
  /**
   * Bentuk nama yang divalidasi, kalau berbeda dari yang akan disimpan ke
   * database. Form bawaan menyimpan `<section>::<id>` tapi divalidasi bentuk
   * singkatnya.
   */
  normalisasiNama?: (nama: string) => string
  /** true kalau form ini bawaan sistem, bukan form manual. */
  bawaan?: boolean
}

function validateAllFields(
  fields: FieldInput[],
  sections: SectionInput[],
  existingFieldIds: Set<string>,
  opsi: OpsiValidasiField = {},
): HasilValidasi {
  const { normalisasiNama, bawaan = false } = opsi
  const fieldsBySection = new Map<string, FieldInput[]>()
  for (const f of fields) {
    const list = fieldsBySection.get(f.sectionClientId) ?? []
    list.push(f)
    fieldsBySection.set(f.sectionClientId, list)
  }

  for (const [sectionClientId, sectionFields] of fieldsBySection) {
    const section = sections.find((s) => s.clientId === sectionClientId)
    if (!section) {
      return {
        ok: false,
        kode: 'VERSI_TIDAK_ADA',
        pesan: `Section ${sectionClientId} tidak ditemukan untuk field.`,
      }
    }

    const fieldDefs = sectionFields.map((f) => ({
      nama: f.nama,
      label: f.label,
      tipe: f.tipe,
      optionSourceType: f.optionSourceType,
      optionSourceKey: f.optionSourceKey,
      jumlahKolom: f.jumlahKolom,
      opsi: f.opsi.map((o) => ({ value: o.value, aktif: o.aktif })),
      hapus: false,
      // Field bawaan form sistem sudah ada di database dan tidak bisa diubah
      // admin, jadi bentuknya mengikuti aturan form asal. Field yang baru
      // ditambahkan admin tetap diperiksa penuh.
      fieldBawaan: bawaan && f.id !== null && existingFieldIds.has(f.id),
    }))

    const validation = validasiFieldPenuh({
      fields: fieldDefs,
      normalisasiNama,
    })
    if (!validation.ok) {
      return {
        ok: false,
        kode: validation.kode,
        pesan: `Section ${section.nama}: ${validation.pesan}`,
      }
    }
    // Duplikat nama antar field sudah dicek validasiFieldPenuh di atas, per
    // section (termasuk rename). Tidak ada cek tambahan di sini.
  }

  return { ok: true }
}

/**
 * Pesan untuk field yang sudah punya isian.
 *
 * Dipisah dari {@link pastikanFieldBolehDihapus} supaya bisa diuji tanpa
 * database: yang diuji adalah hitungan dan pemotongan daftar nama, bukan
 * query-nya.
 *
 * @param dipakai hasil `group by fieldId`, sudah berisi jumlah isian per field
 * @param namaField peta `fieldId` -> `form_fields.nama` untuk pesan yang bisa dibaca
 */
export function pesanFieldTerpakai(
  dipakai: { fieldId: string; total: number }[],
  namaField: Map<string, string>,
): string {
  const total = dipakai.reduce((n, d) => n + d.total, 0)
  // Sisakan sampai 3 nama supaya pesan tidak jadi paragraf kalau admin hapus
  // banyak field sekaligus.
  const contoh = dipakai
    .slice(0, 3)
    .map((d) => `"${namaField.get(d.fieldId) ?? d.fieldId}" (${d.total} isian)`)
    .join(', ')
  const sisa =
    dipakai.length > 3 ? `, dan ${dipakai.length - 3} field lainnya` : ''

  return (
    `Field ${contoh}${sisa} sudah punya ${total} isian, jadi tidak bisa dihapus. ` +
    `Nonaktifkan fieldnya lewat ikon mata, atau hapus isiannya dulu.`
  )
}

/**
 * Tolak build yang menghapus field yang sudah punya isian.
 *
 * `survey_entries.fieldId` sengaja `on delete no action` (lihat
 * src/lib/schema/schema.ts), jadi menghapus field yang sudah terisi akan ditolak
 * Postgres dengan pelanggaran foreign key. Kalau tidak dicek di sini, satu field
 * yang bermasalah membatalkan seluruh transaksi build: semua edit lain di versi
 * itu ikut hilang, dan petugas melihat pesan error Postgres yang tidak
 * bisa dipahami.
 *
 * Dicek di dalam transaksi, tepat sebelum delete, supaya tidak ada celah antara
 * pengecekan dan penghapusan. Draft tidak pernah punya isian, jadi jalur ini
 * praktis hanya menyalakan saat admin mengubah form yang sudah tayang.
 */
async function pastikanFieldBolehDihapus(
  tx: DbTx,
  fields: { id: string; nama: string }[],
) {
  if (fields.length === 0) return

  const dipakai = await tx
    .select({ fieldId: surveyEntries.fieldId, total: count() })
    .from(surveyEntries)
    .where(
      inArray(
        surveyEntries.fieldId,
        fields.map((f) => f.id),
      ),
    )
    .groupBy(surveyEntries.fieldId)

  if (dipakai.length === 0) return

  throw new KesalahanValidasi({
    ok: false,
    kode: 'FIELD_TERPAKAI',
    pesan: pesanFieldTerpakai(
      dipakai,
      new Map(fields.map((f) => [f.id, f.nama])),
    ),
  })
}

/**
 * Data yang butuh semua langkah build: isi versi ini dari database, apa yang
 * berubah dari draft admin, dan cara menulis nama field.
 *
 * Dipakai supaya tiap langkah cuma menerima satu objek, bukan lima-enam
 * parameter yang isinya saling terkait.
 */
interface KonteksBuild {
  formVersionId: string
  sectionsInput: SectionInput[]
  fieldsInput: FieldInput[]
  rulesAutofill: BuildFormVersionInput['rulesAutofill']
  rulesVisibilitas: BuildFormVersionInput['rulesVisibilitas']
  /** `forms.kode` form pemilik versi ini. null = form manual. */
  formKode: string | null
  /** Section dan field versi ini dari database, untuk membedakan upsert dari delete. */
  existingSections: ExistingSection[]
  existingFields: ExistingField[]
  /** Section di database yang tidak ada lagi di draft. */
  sectionsToDelete: ExistingSection[]
  /** Field di database yang tidak ada lagi di draft. */
  fieldsToDelete: ExistingField[]
  /**
   * Bentuk nama field saat ditulis ke database.
   *
   * Form bawaan memakai namespace `<section>::<id>`, karena id field-nya dipakai
   * ulang antar section — `nama`, `nik`, `tglLahir` muncul di banyak section,
   * sementara `form_fields.nama` wajib unik per versi form. `namaTanpaPrefix`
   * dijalankan lebih dulu supaya builds berulang tidak menambah `::` ganda.
   * Form manual tidak memakai namespace sama sekali.
   */
  namaTersimpan: (nama: string, sectionNama: string) => string
  /** Waktu tulis untuk kolom `updatedAt`, satu nilai untuk semua baris. */
  now: Date
}

/**
 * Susun {@link KonteksBuild} dari draft dan isi database.
 *
 * Dua query read saja, keduanya di luar transaksi: yang di sini hanya
 * memutuskan apa yang perlu ditulis, tidak menulis apa pun.
 */
async function susunKonteks(
  input: BuildFormVersionInput,
): Promise<KonteksBuild> {
  const {
    formVersionId,
    sections: sectionsInput,
    fields: fieldsInput,
    rulesAutofill,
    rulesVisibilitas,
  } = input
  const { existingSections, existingFields } = await loadExisting(
    db,
    formVersionId,
  )
  const formKode = await ambilKodeFormVersi(db, formVersionId)

  const incomingSectionIds = new Set(
    sectionsInput.filter((s) => s.id).map((s) => s.id!),
  )
  const incomingFieldIds = new Set(
    fieldsInput.filter((f) => f.id).map((f) => f.id!),
  )

  return {
    formVersionId,
    sectionsInput,
    fieldsInput,
    rulesAutofill,
    rulesVisibilitas,
    formKode,
    existingSections,
    existingFields,
    sectionsToDelete: existingSections.filter(
      (s) => !incomingSectionIds.has(s.id),
    ),
    fieldsToDelete: existingFields.filter((f) => !incomingFieldIds.has(f.id)),
    namaTersimpan:
      formKode !== null
        ? (nama: string, sectionNama: string) =>
            namaDenganPrefix(sectionNama, namaTanpaPrefix(nama))
        : (nama: string) => nama,
    now: new Date(),
  }
}

/**
 * Validasi draft sebelum ada satu baris pun ditulis.
 *
 * Semuanya selesai di sini supaya transaksi tidak pernah mulai kalau build-nya
 * pasti ditolak: Postgres membatalkan seluruh transaksi saat error, jadi validasi
 * yang telat harus membatalkan semua edit lain di versi yang sama.
 */
function validasiDraft(ctx: KonteksBuild): void {
  const { sectionsInput, fieldsInput, existingFields, formKode } = ctx
  const bawaan = formKode !== null
  const existingFieldIds = new Set(existingFields.map((f) => f.id))
  const fieldClientIds = new Set(fieldsInput.map((f) => f.clientId))
  const sectionClientIds = new Set(sectionsInput.map((s) => s.clientId))

  for (const rule of ctx.rulesAutofill) {
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
  for (const rule of ctx.rulesVisibilitas) {
    const targetAda =
      rule.targetType === 'field'
        ? fieldClientIds.has(rule.targetId)
        : sectionClientIds.has(rule.targetId)
    if (!fieldClientIds.has(rule.triggerFieldId) || !targetAda) {
      throw new KesalahanValidasi({
        ok: false,
        kode: 'FIELD_TIDAK_ADA',
        pesan:
          'Aturan visibilitas merujuk field atau section yang tidak ada di draft.',
      })
    }
  }

  // Pola nama field menolak `::`, jadi yang divalidasi adalah bentuk pendeknya
  // sementara yang ditulis ke database memakai namespace.
  const normalisasiNama = bawaan ? namaTanpaPrefix : undefined

  pastikan(validateAllSections(sectionsInput))
  pastikan(
    validateAllFields(fieldsInput, sectionsInput, existingFieldIds, {
      normalisasiNama,
      bawaan,
    }),
  )

  // Form bawaan bentuknya dipetakan balik ke UI-nya lewat nama section, prefix
  // nama field, dan bucket. Validator di atas hanya melihat apa yang boleh diedit;
  // yang satu ini melihat akibatnya ke UI form. `aturanForm` yang memilih
  // aturannya, jadi pemanggil tidak perlu tahu kode form mana yang dikunci.
  const sectionClientIdKeId = new Map(
    sectionsInput.map((s) => [s.clientId, s.id ?? null]),
  )
  pastikan(
    aturanForm(formKode).validasiDraft({
      sections: sectionsInput.map((s) => ({ id: s.id, nama: s.nama })),
      fields: fieldsInput.map((f) => ({
        id: f.id,
        sectionId: sectionClientIdKeId.get(f.sectionClientId) ?? null,
        nama: f.nama,
        tipe: f.tipe,
        optionSourceType: f.optionSourceType,
        optionSourceKey: f.optionSourceKey,
      })),
      sectionsLama: ctx.existingSections.map((s) => ({
        id: s.id,
        nama: s.nama,
      })),
      fieldsLama: existingFields.map((f) => ({
        id: f.id,
        sectionId: f.sectionId,
        nama: f.nama,
        optionSourceKey: f.optionSourceKey,
      })),
    }),
  )
}

/**
 * Langkah 1 — tulis section.
 *
 * `urutan` diambil dari posisi di payload, jadi urutan di editor langsung jadi
 * urutan tampil. Section harus ditulis lebih dulu karena field menunjuk
 * `sectionId` yang harus sudah ada.
 *
 * @returns peta `clientId` payload -> `id` database, dipakai langkah 2.
 */
async function tulisSections(
  tx: DbTx,
  ctx: KonteksBuild,
): Promise<Map<string, string>> {
  const { formVersionId, sectionsInput, existingSections, now } = ctx
  const sectionClientIdToId = new Map<string, string>()

  for (const [urutan, s] of sectionsInput.entries()) {
    const existing = s.id
      ? existingSections.find((es) => es.id === s.id)
      : undefined
    if (existing) {
      const [updated] = await tx
        .update(formSections)
        .set({
          nama: s.nama,
          deskripsi: s.deskripsi,
          urutan,
          aktif: s.aktif,
          updatedAt: now,
        })
        .where(eq(formSections.id, existing.id))
        .returning({ id: formSections.id })

      if (updated) sectionClientIdToId.set(s.clientId, updated.id)
    } else {
      const [inserted] = await tx
        .insert(formSections)
        .values({
          formVersionId,
          nama: s.nama,
          deskripsi: s.deskripsi,
          urutan,
          aktif: s.aktif,
        })
        .returning({ id: formSections.id })

      if (inserted) sectionClientIdToId.set(s.clientId, inserted.id)
    }
  }

  // Setiap section wajib punya id asli sebelum field ditulis, jadi sisipan yang
  // gagal ketahuan di sini, bukan saat insert field menggagalkan seluruh
  // transaksi dengan pesan yang tidak menjelaskan penyebabnya.
  for (const section of sectionsInput) {
    if (!sectionClientIdToId.has(section.clientId)) {
      throw new KesalahanValidasi({
        ok: false,
        kode: 'VERSI_TIDAK_ADA',
        pesan: `Section ${section.clientId} gagal disimpan.`,
      })
    }
  }

  return sectionClientIdToId
}

/**
 * Langkah 2 — tulis field dengan `sectionId` yang baru.
 *
 * Field yang pindah section tetap satu baris: `sectionId` di-update, bukan
 * dihapus lalu disisipkan, supaya `survey_entries` yang menunjuk field itu tidak
 * ikut hilang.
 *
 * @returns peta `clientId` payload -> `id` database, dipakai langkah 4.
 */
async function tulisFields(
  tx: DbTx,
  ctx: KonteksBuild,
  sectionClientIdToId: Map<string, string>,
): Promise<Map<string, string>> {
  const {
    formVersionId,
    sectionsInput,
    fieldsInput,
    existingFields,
    namaTersimpan,
    now,
  } = ctx
  const fieldClientIdToId = new Map<string, string>()

  for (const section of sectionsInput) {
    const sectionId = sectionClientIdToId.get(section.clientId)!
    const sectionFields = fieldsInput.filter(
      (f) => f.sectionClientId === section.clientId,
    )

    for (const [i, field] of sectionFields.entries()) {
      const existing = field.id
        ? existingFields.find((ef) => ef.id === field.id)
        : undefined

      const fieldData = {
        formVersionId,
        sectionId,
        nama: namaTersimpan(field.nama, section.nama),
        label: field.label,
        tipe: field.tipe,
        // Ditulis apa adanya dari payload, bukan diturunkan dari `opsi`.
        // Versi lama menurunkan optionSourceType dari panjang `opsi` dan
        // selalu mengosongkan optionSourceKey, sehingga pilihan dari sumber
        // data yang sudah ada hilang begitu admin Build.
        optionSourceType: field.optionSourceType,
        optionSourceKey: field.optionSourceKey,
        deskripsi: field.deskripsi,
        placeholder: field.placeholder,
        wajib: field.wajib,
        urutan: i,
        jumlahKolom: field.tipe === 'group' ? field.jumlahKolom : null,
        aktif: field.aktif,
        updatedAt: now,
      }

      if (existing) {
        const [updated] = await tx
          .update(formFields)
          .set(fieldData)
          .where(eq(formFields.id, existing.id))
          .returning({ id: formFields.id })

        if (!updated) {
          throw new KesalahanValidasi({
            ok: false,
            kode: 'FIELD_TIDAK_ADA',
            pesan: `Field ${field.nama} gagal diupdate.`,
          })
        }
        fieldClientIdToId.set(field.clientId, updated.id)
      } else {
        const [inserted] = await tx
          .insert(formFields)
          .values(fieldData)
          .returning({ id: formFields.id })

        if (!inserted) {
          throw new KesalahanValidasi({
            ok: false,
            kode: 'VERSI_TIDAK_ADA',
            pesan: `Field ${field.nama} gagal disimpan.`,
          })
        }
        fieldClientIdToId.set(field.clientId, inserted.id)
      }
    }
  }

  return fieldClientIdToId
}

/**
 * Langkah 3 — hapus field yang tidak ada lagi di draft.
 *
 * Field hilang karena dua sebab: tidak ada di payload, atau section-nya dihapus
 * (ikut cascade di langkah 5). Section ikut diperiksa karena menghapus satu
 * section bisa menjatuhkan banyak field yang belum pernah dicek satu per satu.
 *
 * Pengecekan "punya isian atau tidak" dijalankan SEBELUM loop delete, sekaligus
 * untuk semua field yang hilang, supaya admin mendapat satu pesan berisi semua
 * field bermasalah — bukan baru tahu field berikutnya setelah menyimpan ulang.
 */
async function hapusFieldHilang(tx: DbTx, ctx: KonteksBuild): Promise<void> {
  const { fieldsInput, existingFields, sectionsToDelete } = ctx

  const sectionIdsDihapus = new Set(sectionsToDelete.map((s) => s.id))
  const fieldsDihapus = new Map<string, { id: string; nama: string }>()
  for (const f of ctx.fieldsToDelete)
    fieldsDihapus.set(f.id, { id: f.id, nama: f.nama })
  for (const f of existingFields) {
    if (sectionIdsDihapus.has(f.sectionId))
      fieldsDihapus.set(f.id, { id: f.id, nama: f.nama })
  }
  await pastikanFieldBolehDihapus(tx, [...fieldsDihapus.values()])

  for (const existing of existingFields) {
    const masihDiDraft = fieldsInput.some((f) => f.id === existing.id)
    if (!masihDiDraft) {
      await tx.delete(formFields).where(eq(formFields.id, existing.id))
    }
  }
}

/**
 * Langkah 4 — tulis ulang pilihan jawaban tiap field.
 *
 * Baris lama dihapus dulu per field, lalu yang baru disisipkan. Menulis ulang
 * seluruh baris (bukan meny-matching per nilai) adalah pilihan yang disengaja:
 * urutan opsi ikut berperan di render, dan mencocokkan baris lama per nilai
 * membuat urutan yang berubah-ubah sulit dilacak.
 */
async function tulisOpsi(
  tx: DbTx,
  ctx: KonteksBuild,
  fieldClientIdToId: Map<string, string>,
): Promise<void> {
  for (const field of ctx.fieldsInput) {
    const fieldId = fieldClientIdToId.get(field.clientId)
    if (!fieldId) continue

    await tx
      .delete(formFieldOptions)
      .where(eq(formFieldOptions.fieldId, fieldId))
    await sisipkanOpsi(tx, fieldId, field.opsi)
  }
}

/** Ganti aturan versi dengan draft setelah ID sementara dipetakan ke database. */
async function tulisAturan(
  tx: DbTx,
  ctx: KonteksBuild,
  fieldIds: Map<string, string>,
  sectionIds: Map<string, string>,
): Promise<void> {
  await tx
    .delete(formFieldAutofills)
    .where(eq(formFieldAutofills.formVersionId, ctx.formVersionId))
  await tx
    .delete(formFieldVisibilityRules)
    .where(eq(formFieldVisibilityRules.formVersionId, ctx.formVersionId))

  if (ctx.rulesAutofill.length > 0) {
    await tx.insert(formFieldAutofills).values(
      ctx.rulesAutofill.map((rule, urutan) => {
        const triggerFieldId = fieldIds.get(rule.triggerFieldId)
        const targetFieldId = fieldIds.get(rule.targetFieldId)
        if (!triggerFieldId || !targetFieldId) {
          throw new KesalahanValidasi({
            ok: false,
            kode: 'FIELD_TIDAK_ADA',
            pesan: 'Field aturan autofill gagal dipetakan ke database.',
          })
        }
        return {
          formVersionId: ctx.formVersionId,
          triggerFieldId,
          targetFieldId,
          sumber: rule.sumber,
          kolom: rule.kolom,
          transform: rule.transform,
          mode: rule.mode,
          urutan,
          aktif: rule.aktif,
        }
      }),
    )
  }

  if (ctx.rulesVisibilitas.length > 0) {
    await tx.insert(formFieldVisibilityRules).values(
      ctx.rulesVisibilitas.map((rule, urutan) => {
        const triggerFieldId = fieldIds.get(rule.triggerFieldId)
        const targetId =
          rule.targetType === 'field'
            ? fieldIds.get(rule.targetId)
            : sectionIds.get(rule.targetId)
        if (!triggerFieldId || !targetId) {
          throw new KesalahanValidasi({
            ok: false,
            kode: 'FIELD_TIDAK_ADA',
            pesan:
              'Field atau section aturan visibilitas gagal dipetakan ke database.',
          })
        }
        return {
          formVersionId: ctx.formVersionId,
          targetType: rule.targetType,
          targetId,
          triggerFieldId,
          operator: rule.operator,
          nilaiAcuan: rule.nilaiAcuan,
          aktif: rule.aktif,
          urutan,
        }
      }),
    )
  }
}

/**
 * Langkah 5 — hapus section yang tidak ada lagi di draft.
 *
 * Field milik section yang dihapus sudah hilang di langkah 3, dan yang masih
 * tertinggal ikut hilang lewat cascade di sini. Karena itu langkah 5 wajib
 * setelah langkah 3: kalau dibalik, cascade ikut menghapus field tanpa pernah
 * melewati pengecekan "punya isian atau tidak".
 */
async function hapusSections(tx: DbTx, ctx: KonteksBuild): Promise<void> {
  for (const s of ctx.sectionsToDelete) {
    await tx.delete(formSections).where(eq(formSections.id, s.id))
  }
}

/**
 * Bangun satu versi form dari draft admin.
 *
 * Lima langkah, semuanya dalam satu transaksi dan dalam urutan ini:
 *   1. Tulis section — field butuh `sectionId` yang asli
 *   2. Tulis field — butuh `fieldId` asli untuk menimpa baris jawabannya
 *   3. Hapus field yang hilang, setelah dicek tidak punya isian
 *   4. Tulis ulang pilihan jawaban tiap field
 *   5. Hapus section yang hilang — field-nya ikut cascade, makanya setelah langkah 3
 *
 * Urutannya tidak boleh diacak: menukar langkah 1 dan 2 membuat field menunjuk
 * section yang belum ada, dan menukar langkah 3 dan 5 membuat field ikut terhapus
 * sebelum sempat dicek apakah isiannya ada.
 */
export async function buildFormVersion(
  input: BuildFormVersionInput,
): Promise<BuildFormVersionResult> {
  const { formVersionId, actorId } = input

  await assertVersiBisaDiubah(formVersionId)

  const ctx = await susunKonteks(input)
  validasiDraft(ctx)

  const result = await db.transaction(async (tx) => {
    // Urutan lima langkah ini mengikat: lihat docstring `buildFormVersion`.
    const sectionClientIdToId = await tulisSections(tx, ctx)
    const fieldClientIdToId = await tulisFields(tx, ctx, sectionClientIdToId)
    await tulisAturan(tx, ctx, fieldClientIdToId, sectionClientIdToId)
    await hapusFieldHilang(tx, ctx)
    await tulisOpsi(tx, ctx, fieldClientIdToId)
    await hapusSections(tx, ctx)

    return {
      jumlahSection: ctx.sectionsInput.length,
      jumlahField: ctx.fieldsInput.length,
      jumlahDihapus: ctx.sectionsToDelete.length + ctx.fieldsToDelete.length,
    }
  })

  await catatAudit({
    userId: actorId ?? null,
    aksi: 'update',
    entitas: 'form_versions',
    entitasId: formVersionId,
    sesudah: {
      formVersionId,
      jumlahSection: result.jumlahSection,
      jumlahField: result.jumlahField,
      jumlahDihapus: result.jumlahDihapus,
    },
  })

  return result
}
