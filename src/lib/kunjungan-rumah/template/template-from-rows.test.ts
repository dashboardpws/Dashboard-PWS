import { describe, expect, it } from 'vitest'
import { templateFromRows } from './template-from-rows'
import type {
  KunjunganRumahTemplateRows,
  TemplateQuestionRow,
  TemplateSectionRow,
} from './template-from-rows'
import {
  KUNJUNGAN_RUMAH_TEMPLATE_VERSION,
  createDefaultKunjunganRumahTemplates,
} from './kunjungan-rumah-templates'
import type { KunjunganRumahTemplates } from './kunjungan-rumah-templates'
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
  const sections: TemplateSectionRow[] = []

  for (const section of t.sections) {
    sections.push({
      nama: section.name,
      label: section.label,
      description: section.description,
      urutan: section.order,
      aktif: section.active,
      sectionKind: section.kind,
      layoutGroups: section.layoutGroups,
    })
    questions[section.name] = section.fields.map((f, i) => ({
      kode: f.id,
      pertanyaan: f.label,
      tipe: f.kind,
      bucket: null,
      hint: f.hint ?? null,
      wajib: f.required,
      urutan: i + 1,
      aktif: f.active,
      opsi: f.options ?? [],
      placeholder: f.placeholder ?? null,
      layoutGroup: f.layoutGroup ?? null,
    }))
  }

  for (const key of SASARAN_KEYS) {
    sections.push({
      nama: key,
      label: t.sasaran[key].label,
      description: null,
      urutan: t.sasaranOrder,
      aktif: true,
      sectionKind: 'sasaran',
      layoutGroups: t.sasaran[key].layoutGroups,
    })
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
        aktif: f.active,
        opsi: f.options ?? [],
        placeholder: f.placeholder ?? null,
        layoutGroup: f.layoutGroup ?? null,
      })
    }
    questions[key] = rows
  }

  return {
    formVersionId: 'versi-uji',
    versiDefinisi: VERSION,
    sections,
    questions,
  }
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

  it('merender section baru yang tidak dikenal sebagai section generik', () => {
    const asli = createDefaultKunjunganRumahTemplates()
    const rows = rowsFromTemplate(asli)
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
    const generik = hasil.sections.find((s) => s.name === 'sectionEntah')
    expect(generik).toMatchObject({
      name: 'sectionEntah',
      kind: 'form_generik',
      active: true,
    })
    expect(generik?.fields).toEqual([
      expect.objectContaining({
        id: 'x',
        section: 'sectionEntah',
        kind: 'text',
      }),
    ])
    // Section bawaan tetap utuh, bukan tergantikan oleh section generik.
    expect(hasil.keluargaInfo).toEqual(asli.keluargaInfo)
  })

  it('mempertahankan metadata section generik dan kelompok layout-nya', () => {
    const asli = createDefaultKunjunganRumahTemplates()
    const rows = rowsFromTemplate(asli)
    rows.sections!.push({
      nama: 'catatanTambahan',
      label: 'Catatan Tambahan',
      description: 'Bagian tambahan dari Form Builder.',
      urutan: 6,
      aktif: true,
      sectionKind: 'form_generik',
      layoutGroups: [{ key: 'kondisi', label: 'Kondisi Rumah', order: 0 }],
    })
    rows.questions['catatanTambahan'] = [
      {
        kode: 'catatan',
        pertanyaan: 'Catatan kader',
        tipe: 'text',
        bucket: null,
        hint: null,
        wajib: true,
        urutan: 1,
        aktif: true,
        opsi: [],
        placeholder: 'Tulis catatan…',
        layoutGroup: 'kondisi',
      },
    ]

    const hasil = templateFromRows(rows)
    const section = hasil.sections.find((s) => s.name === 'catatanTambahan')
    expect(section).toMatchObject({
      label: 'Catatan Tambahan',
      description: 'Bagian tambahan dari Form Builder.',
      kind: 'form_generik',
      order: 6,
    })
    expect(section?.layoutGroups).toEqual([
      { key: 'kondisi', label: 'Kondisi Rumah', order: 0 },
    ])
    expect(section?.fields[0]).toMatchObject({
      id: 'catatan',
      placeholder: 'Tulis catatan…',
      layoutGroup: 'kondisi',
      required: true,
    })
  })

  it('nama section bawaan tetap menang atas sectionKind yang salah', () => {
    const rows = rowsFromTemplate(createDefaultKunjunganRumahTemplates())
    rows.sections!.find((s) => s.nama === 'keluargaInfo')!.sectionKind =
      'form_generik'

    const hasil = templateFromRows(rows)
    expect(hasil.sections.find((s) => s.name === 'keluargaInfo')?.kind).toBe(
      'keluarga',
    )
  })

  it('mempertahankan section yang dinonaktifkan tanpa membuang fieldnya', () => {
    const rows = rowsFromTemplate(createDefaultKunjunganRumahTemplates())
    const sanitasi = rows.sections!.find((s) => s.nama === 'sanitasi')!
    sanitasi.aktif = false

    const hasil = templateFromRows(rows)
    const section = hasil.sections.find((s) => s.name === 'sanitasi')!
    expect(section.active).toBe(false)
    // Field tetap terbaca; renderer yang memutuskan tidak menampilkannya.
    expect(section.fields.length).toBeGreaterThan(0)
  })

  it('menambal section hasil dan menjaga urutan kartu pada definisi lama', () => {
    // Tiru database lama: section `hasil` belum pernah di-seed, belum ada
    // `sectionKind`, dan section sasaran tersimpan setelah masalah.
    const rows = rowsFromTemplate(createDefaultKunjunganRumahTemplates())
    delete rows.questions['hasil']
    rows.sections = rows.sections!.filter((s) => s.nama !== 'hasil')
    for (const section of rows.sections) section.sectionKind = null
    const urutan = new Map<string, number>([
      ['keluargaInfo', 0],
      ['anggota', 1],
      ['sanitasi', 2],
      ['masalah', 3],
    ])
    SASARAN_KEYS.forEach((key, index) => urutan.set(key, 5 + index * 2))
    for (const section of rows.sections) {
      const nilai = urutan.get(section.nama)
      if (nilai !== undefined) section.urutan = nilai
    }

    const hasil = templateFromRows(rows)
    const sectionHasil = hasil.sections.find((s) => s.kind === 'hasil')
    expect(sectionHasil).toMatchObject({
      name: 'hasil',
      active: true,
      fields: [],
    })
    const sectionMasalah = hasil.sections.find((s) => s.kind === 'masalah')
    expect(sectionHasil!.order).toBe(sectionMasalah!.order + 1)
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

  it('menyalin prioritasDefault dari kode dan hasilOpsi dari field hasil', () => {
    const asli = createDefaultKunjunganRumahTemplates()
    const rows = rowsFromTemplate(asli)
    rows.questions.hasil![0]!.opsi = ['Selesai', 'Kontrol', 'Rujuk']
    const hasil = templateFromRows(rows)
    expect(hasil.hasilOpsi).toEqual(['Selesai', 'Kontrol', 'Rujuk'])
    for (const key of SASARAN_KEYS) {
      expect(hasil.sasaran[key].prioritasDefault).toEqual(
        asli.sasaran[key].prioritasDefault,
      )
    }
  })
})

describe('templateFromRows Iteration 3 Guard & Dynamic Sections', () => {
  it('should include generic custom sections in the sections array', () => {
    const mockRows: KunjunganRumahTemplateRows = {
      formVersionId: 'versi-uji-custom',
      versiDefinisi: VERSION,
      sections: [
        {
          nama: 'custom-edukasi-tambahan',
          label: 'Edukasi Tambahan',
          description: null,
          urutan: 10,
          aktif: true,
          sectionKind: 'form_generik',
        },
      ],
      questions: {
        'custom-edukasi-tambahan': [
          {
            kode: 'catatanKhusus',
            pertanyaan: 'Catatan Khusus',
            tipe: 'text',
            bucket: null,
            hint: null,
            wajib: false,
            urutan: 1,
            aktif: true,
            opsi: [],
          },
        ],
      },
    }

    const result = templateFromRows(mockRows)
    const customSection = result.sections.find(
      (s) => s.name === 'custom-edukasi-tambahan',
    )

    expect(customSection).toBeDefined()
    expect(customSection?.kind).toBe('form_generik')
    expect(customSection?.fields.length).toBe(1)
  })

  it('should correctly infer sectionKind for legacy built-in sections missing sectionKind metadata', () => {
    const mockLegacyRows: KunjunganRumahTemplateRows = {
      formVersionId: 'versi-uji-legacy',
      versiDefinisi: VERSION,
      sections: [
        {
          nama: 'keluargaInfo',
          label: 'Informasi Keluarga',
          description: null,
          urutan: 0,
          aktif: true,
          sectionKind: null,
        },
      ],
      questions: {
        keluargaInfo: [
          {
            kode: 'alamat',
            pertanyaan: 'Alamat',
            tipe: 'text',
            bucket: null,
            hint: null,
            wajib: false,
            urutan: 1,
            aktif: true,
            opsi: [],
          },
        ],
      },
    }

    const result = templateFromRows(mockLegacyRows)
    const keluargaSection = result.sections.find(
      (s) => s.name === 'keluargaInfo',
    )

    expect(keluargaSection).toBeDefined()
    expect(keluargaSection?.kind).toBe('keluarga')
  })
})
