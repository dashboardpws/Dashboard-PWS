import { describe, expect, it } from 'vitest'
import { templateFromRows } from './template-from-rows'
import type {
  KunjunganRumahTemplateRows,
  TemplateQuestionRow,
} from './template-from-rows'
import {
  KUNJUNGAN_RUMAH_TEMPLATE_VERSION,
  createDefaultKunjunganRumahTemplates,
} from './kunjungan-rumah-templates'
import type {
  KunjunganRumahTemplateField,
  KunjunganRumahTemplates,
} from './kunjungan-rumah-templates'
import { SASARAN_KEYS } from './kunjungan-rumah-form'

const VERSION = KUNJUNGAN_RUMAH_TEMPLATE_VERSION

const BUCKET_BY_SECTION: Record<string, string> = {
  'sasaran:identitas': 'identitas',
  'sasaran:kolom': 'kolom',
  'sasaran:bools': 'bools',
  'sasaran:baha': 'baha',
}

function bucketOf(section: string): string {
  const bucket = BUCKET_BY_SECTION[section]
  if (!bucket)
    throw new Error(`Section "${section}" tidak punya bucket yang dipetakan`)
  return bucket
}

/** Balik `KunjunganRumahTemplates` jadi bentuk baris DB, supaya mapper bisa diuji tanpa database. */
function rowsFromTemplate(
  t: KunjunganRumahTemplates,
  opts?: { insertGroups?: boolean },
): KunjunganRumahTemplateRows {
  const questions: Record<string, TemplateQuestionRow[]> = {}
  const plain: [string, KunjunganRumahTemplateField[]][] = [
    ['keluargaInfo', t.keluargaInfo],
    ['anggota', t.anggota],
    ['sanitasi', t.sanitasi],
    ['masalah', t.masalah],
  ]

  for (const [section, fields] of plain) {
    questions[section] = fields.map((f, i) => ({
      kode: f.id,
      pertanyaan: f.label,
      tipe: f.kind,
      bucket: null,
      hint: f.hint ?? null,
      wajib: f.required,
      urutan: i + 1,
      aktif: true,
      opsi: f.options ?? [],
    }))
  }

  for (const key of SASARAN_KEYS) {
    const rows: TemplateQuestionRow[] = []
    let urutan = 0
    const fields = t.sasaran[key].fields
    for (const f of fields) {
      // Seeder menulis baris `tipe: "group"` sebelum anak pertama tiap blok (K1, KF1, dst).
      // Baris itu tidak pernah dirender, tapi ikut menghitung kolom `urutan`.
      if (
        opts?.insertGroups &&
        !rows.some((r) => r.bucket === bucketOf(f.section))
      ) {
        urutan += 1
        rows.push({
          kode: `__grup_${key}_${bucketOf(f.section)}`,
          pertanyaan: 'Grup',
          tipe: 'group',
          bucket: bucketOf(f.section),
          hint: null,
          wajib: false,
          urutan,
          aktif: true,
          opsi: [],
        })
      }
      rows.push({
        kode: f.id,
        pertanyaan: f.label,
        tipe: f.kind,
        bucket: bucketOf(f.section),
        hint: f.hint ?? null,
        wajib: f.required,
        urutan: ++urutan,
        aktif: true,
        opsi: f.options ?? [],
      })
    }
    questions[key] = rows
  }

  return { formVersionId: 'versi-uji', versiDefinisi: VERSION, questions }
}

describe('templateFromRows', () => {
  it('menghasilkan template yang identik dengan template bawaan', () => {
    const asli = createDefaultKunjunganRumahTemplates()
    const hasil = templateFromRows(rowsFromTemplate(asli))
    expect(hasil).toEqual(asli)
  })

  it('tetap sama urutan field walau ada baris grup di database', () => {
    // `order` harus dihitung ulang setelah grup dibuang; kalau tidak, semua field
    // setelah grup pertama akan geser dan urutan tampil jadi salah.
    const asli = createDefaultKunjunganRumahTemplates()
    const hasil = templateFromRows(
      rowsFromTemplate(asli, { insertGroups: true }),
    )
    expect(hasil).toEqual(asli)
  })

  it('melewati section yang tidak dikenal tanpa menggagalkan form', () => {
    const asli = createDefaultKunjunganRumahTemplates()
    const rows = rowsFromTemplate(asli)
    rows.questions['hasil'] = []
    rows.questions['sectionEntah'] = [
      {
        kode: 'x',
        pertanyaan: 'X',
        tipe: 'text',
        bucket: null,
        hint: null,
        wajib: false,
        urutan: 1,
        aktif: true,
        opsi: [],
      },
    ]
    const hasil = templateFromRows(rows)
    expect(hasil).toEqual(asli)
  })

  it('menolak baris dengan bucket yang tidak dikenal', () => {
    const rows = rowsFromTemplate(createDefaultKunjunganRumahTemplates())
    rows.questions['ibu-hamil']![0]!.bucket = 'entah'
    expect(() => templateFromRows(rows)).toThrow(/bucket tidak valid/)
  })

  it('toleransi nomor versi definisi yang sudah naik setelah publish ulang', () => {
    // Publish revisi baru lewat Form Builder menaikkan `form_versions.version`.
    // Itu perubahan yang wajar, jadi mapper tidak boleh menolak definisi hanya
    // karena nomornya berbeda dari konstanta template di kode.
    const asli = createDefaultKunjunganRumahTemplates()
    const rows = rowsFromTemplate(asli)
    rows.versiDefinisi = VERSION + 1
    expect(templateFromRows(rows)).toEqual(asli)
  })

  it('menyalin flag aktif dari baris, jadi field nonaktif disembunyikan dari kader', () => {
    const asli = createDefaultKunjunganRumahTemplates()
    const rows = rowsFromTemplate(asli)
    const nik = rows.questions['keluargaInfo']!.find((r) => r.kode === 'nik')!
    nik.aktif = false
    const hasil = templateFromRows(rows)
    expect(hasil.keluargaInfo.find((f) => f.id === 'nik')!.active).toBe(false)
    expect(hasil.keluargaInfo.find((f) => f.id === 'alamat')!.active).toBe(true)
  })

  it('menyertakan opsi select dan mengabaikan opsi pada field non-select', () => {
    const asli = createDefaultKunjunganRumahTemplates()
    const hasil = templateFromRows(rowsFromTemplate(asli))
    const jk = hasil.anggota.find((f) => f.id === 'jk')!
    expect(jk.kind).toBe('select')
    expect(jk.options).toEqual(['L', 'P'])

    const nama = hasil.anggota.find((f) => f.id === 'nama')!
    expect(nama.kind).toBe('text')
    expect(nama.options).toBeUndefined()
  })

  it('menyalin prioritasDefault dan hasilOpsi dari kode, bukan dari baris', () => {
    const asli = createDefaultKunjunganRumahTemplates()
    const hasil = templateFromRows(rowsFromTemplate(asli))
    expect(hasil.hasilOpsi).toEqual(asli.hasilOpsi)
    for (const key of SASARAN_KEYS) {
      expect(hasil.sasaran[key].prioritasDefault).toEqual(
        asli.sasaran[key].prioritasDefault,
      )
    }
  })
})
