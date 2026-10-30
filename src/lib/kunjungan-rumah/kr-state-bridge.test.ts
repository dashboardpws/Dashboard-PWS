import { describe, expect, it } from 'vitest'
import { initialKunjunganRumahState } from './store/kunjungan-rumah-reducer'
import { createDefaultKunjunganRumahTemplates } from './template/kunjungan-rumah-templates'
import {
  answersToKrState,
  bersihkanFieldTersembunyiKR,
  buatKrFieldBindings,
  evaluasiVisibilitasKR,
  krStateToAnswers,
  terapkanAutofillKeStateKR,
  type KrFieldBinding,
} from './kr-state-bridge'

describe('bridge state Form KR', () => {
  const bindings: KrFieldBinding[] = [
    { fieldId: 'field-nik', path: 'info.nik' },
    { fieldId: 'field-jkn', path: 'sanitasi.jkn' },
  ]

  it('membuat binding UUID dari field info dan sanitasi yang berasal dari DB', () => {
    const templates = createDefaultKunjunganRumahTemplates()
    templates.keluargaInfo[0]!.runtimeId = 'field-tanggal'
    templates.keluargaInfo[0]!.runtimeSectionId = 'section-info'
    templates.sanitasi[0]!.runtimeId = 'field-jkn'
    templates.sanitasi[0]!.runtimeSectionId = 'section-sanitasi'

    expect(buatKrFieldBindings(templates)).toEqual([
      {
        fieldId: 'field-tanggal',
        path: 'info.tglPengumpulan',
        sectionId: 'section-info',
      },
      {
        fieldId: 'field-jkn',
        path: 'sanitasi.jkn',
        sectionId: 'section-sanitasi',
      },
    ])
  })

  it('membaca nilai legacy dengan key UUID yang terikat', () => {
    const state = initialKunjunganRumahState()
    state.info.nik = '3201234567890123'
    state.sanitasi.jkn = true

    const answers = krStateToAnswers(state, bindings)

    expect(answers['field-nik']).toBe('3201234567890123')
    expect(answers['field-jkn']).toBe(true)
    expect(answers.info).toEqual(state.info)
    expect(answers.anggota).toEqual(state.anggota)
    expect(answers.penilaian).toEqual(state.penilaian)
    expect(answers.fotos).toEqual(state.fotos)
  })

  it('mengaplikasikan autofill UUID tanpa menghapus nilai legacy tetangga', () => {
    const state = initialKunjunganRumahState()
    state.info.namaKK = 'Keluarga Lama'
    state.sanitasi.ventilasi = true

    const next = answersToKrState(
      { 'field-nik': '3201234567890123', 'field-jkn': true },
      state,
      bindings,
    )

    expect(next.info.nik).toBe('3201234567890123')
    expect(next.info.namaKK).toBe('Keluarga Lama')
    expect(next.sanitasi.jkn).toBe(true)
    expect(next.sanitasi.ventilasi).toBe(true)
    expect(next.anggota).toEqual(state.anggota)
    expect(next.penilaian).toEqual(state.penilaian)
    expect(next.fotos).toEqual(state.fotos)
  })

  it('mempertahankan arrays legacy saat jawaban tidak memuat perubahan array', () => {
    const state = initialKunjunganRumahState()
    state.hasil = 'Perlu kontrol'
    state.jadwal = '2026-11-02'
    state.ttd = 'Kader'
    state.fotos = [
      { id: 'foto-1', name: 'rumah.jpg', caption: 'Rumah', takenAt: '' },
    ]

    const next = answersToKrState(
      { 'field-nik': '3201234567890123' },
      state,
      bindings,
    )

    expect(next.hasil).toBe(state.hasil)
    expect(next.jadwal).toBe(state.jadwal)
    expect(next.ttd).toBe(state.ttd)
    expect(next.fotos).toEqual(state.fotos)
  })

  it('mengirim rule autofill UUID ke engine lalu memetakan hasilnya ke legacy', () => {
    const state = initialKunjunganRumahState()
    state.info.namaKK = 'Nama yang sudah diisi kader'

    const hasil = terapkanAutofillKeStateKR({
      state,
      bindings,
      rules: [
        {
          id: 'rule-nik',
          triggerFieldId: 'field-pencarian',
          targetFieldId: 'field-nik',
          sumber: 'warga',
          kolom: 'nik',
          transform: 'nik',
          mode: 'isi_kosong',
          aktif: true,
          urutan: 0,
        },
        {
          id: 'rule-target-tidak-terpetakan',
          triggerFieldId: 'field-pencarian',
          targetFieldId: 'info.namaKk',
          sumber: 'warga',
          kolom: 'namaKk',
          transform: 'teks',
          mode: 'timpa',
          aktif: true,
          urutan: 1,
        },
      ],
      konteks: { wargaTerpilih: { nik: '3201234567890123' } },
      triggerFieldId: 'field-pencarian',
    })

    expect(hasil.changed).toBe(true)
    expect(hasil.appliedTargets).toEqual(['field-nik'])
    expect(hasil.state.info.nik).toBe('3201234567890123')
    expect(hasil.state.info.namaKK).toBe('Nama yang sudah diisi kader')
  })

  it('mengirim rule visibilitas UUID dan membersihkan nilai field tersembunyi', () => {
    const state = initialKunjunganRumahState()
    state.info.nik = '3201234567890123'
    state.sanitasi.jkn = true
    const rules = [
      {
        id: 'rule-vis-jkn',
        targetType: 'field' as const,
        targetId: 'field-jkn',
        triggerFieldId: 'field-nik',
        operator: 'eq' as const,
        nilaiAcuan: 'Ya',
        aktif: true,
        urutan: 0,
      },
    ]

    const visibilitas = evaluasiVisibilitasKR({ state, bindings, rules })
    const hasil = bersihkanFieldTersembunyiKR({
      state,
      bindings,
      visibilitas,
    })

    expect(visibilitas.fieldAktif.has('field-jkn')).toBe(false)
    expect(hasil.changed).toBe(true)
    expect(hasil.state.sanitasi.jkn).toBe(false)
    expect(hasil.state.info.nik).toBe(state.info.nik)
  })
})
