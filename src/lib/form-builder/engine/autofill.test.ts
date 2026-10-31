import { describe, expect, it } from 'vitest'
import { terapkanAutofill } from './autofill'
import type { RuleAutofill, KonteksAutofill } from './types'

describe('terapkanAutofill', () => {
  it('mengisi field kosong dari data warga', () => {
    const answers = { nik: '' }
    const rules: RuleAutofill[] = [
      {
        id: 'r1',
        triggerFieldId: 'cari_warga',
        targetFieldId: 'nik',
        sumber: 'warga',
        kolom: 'nik',
        transform: 'nik',
        mode: 'isi_kosong',
        aktif: true,
        urutan: 0,
      },
    ]
    const konteks: KonteksAutofill = {
      wargaTerpilih: {
        nik: '3201234567890123',
        namaArt: 'Budi',
      },
    }
    const result = terapkanAutofill({ answers, rules, konteks })
    expect(result.changed).toBe(true)
    expect(result.answersBaru.nik).toBe('3201234567890123')
    expect(result.appliedTargets).toContain('nik')
  })

  it('tidak menimpa jika mode isi_kosong dan field sudah terisi', () => {
    const answers = { nik: '9999999999999999' }
    const rules: RuleAutofill[] = [
      {
        id: 'r1',
        triggerFieldId: 'cari_warga',
        targetFieldId: 'nik',
        sumber: 'warga',
        kolom: 'nik',
        transform: 'nik',
        mode: 'isi_kosong',
        aktif: true,
        urutan: 0,
      },
    ]
    const konteks: KonteksAutofill = {
      wargaTerpilih: {
        nik: '3201234567890123',
      },
    }
    const result = terapkanAutofill({ answers, rules, konteks })
    expect(result.changed).toBe(false)
    expect(result.answersBaru.nik).toBe('9999999999999999')
  })

  it('menimpa jika mode timpa', () => {
    const answers = { nik: '9999999999999999' }
    const rules: RuleAutofill[] = [
      {
        id: 'r1',
        triggerFieldId: 'cari_warga',
        targetFieldId: 'nik',
        sumber: 'warga',
        kolom: 'nik',
        transform: 'nik',
        mode: 'timpa',
        aktif: true,
        urutan: 0,
      },
    ]
    const konteks: KonteksAutofill = {
      wargaTerpilih: {
        nik: '3201234567890123',
      },
    }
    const result = terapkanAutofill({ answers, rules, konteks })
    expect(result.changed).toBe(true)
    expect(result.answersBaru.nik).toBe('3201234567890123')
  })

  it('mendukung nested path tanpa menghapus properti tetangga', () => {
    const answers = {
      info: {
        namaKK: 'Budi',
        nik: '',
      },
      sanitasi: {
        jambanSaniter: 'ada',
      },
    }
    const rules: RuleAutofill[] = [
      {
        id: 'r1',
        triggerFieldId: 'cari_warga',
        targetFieldId: 'info.nik',
        sumber: 'warga',
        kolom: 'nik',
        transform: 'nik',
        mode: 'isi_kosong',
        aktif: true,
        urutan: 0,
      },
    ]
    const konteks: KonteksAutofill = {
      wargaTerpilih: {
        nik: '3201234567890123',
      },
    }
    const result = terapkanAutofill({ answers, rules, konteks })
    expect(result.changed).toBe(true)
    expect((result.answersBaru.info as Record<string, unknown>).nik).toBe(
      '3201234567890123',
    )
    expect((result.answersBaru.info as Record<string, unknown>).namaKK).toBe(
      'Budi',
    ) // tetangga tetap ada
    expect(
      (result.answersBaru.sanitasi as Record<string, unknown>).jambanSaniter,
    ).toBe('ada') // tetangga tetap ada
  })

  it('mengambil dari anggota keluarga (field group)', () => {
    const answers = { nama_anggota: '' }
    const rules: RuleAutofill[] = [
      {
        id: 'r1',
        triggerFieldId: 'pilih_anggota',
        targetFieldId: 'nama_anggota',
        sumber: 'anggota',
        kolom: 'nama',
        transform: 'teks',
        mode: 'isi_kosong',
        aktif: true,
        urutan: 0,
      },
    ]
    const konteks: KonteksAutofill = {
      anggotaKeluarga: [
        { nik: '111', nama: 'Ani', hubungan: 'Anak' },
        { nik: '222', nama: 'Budi', hubungan: 'Suami' },
      ],
    }
    const result = terapkanAutofill({ answers, rules, konteks })
    expect(result.changed).toBe(true)
    expect(result.answersBaru.nama_anggota).toBe('Ani') // dari anggota pertama
  })

  it('hanya memproses rule untuk triggerFieldId tertentu jika diberikan', () => {
    const answers = { nik: '', nama: '' }
    const rules: RuleAutofill[] = [
      {
        id: 'r1',
        triggerFieldId: 'cari_warga',
        targetFieldId: 'nik',
        sumber: 'warga',
        kolom: 'nik',
        transform: 'nik',
        mode: 'isi_kosong',
        aktif: true,
        urutan: 0,
      },
      {
        id: 'r2',
        triggerFieldId: 'lain',
        targetFieldId: 'nama',
        sumber: 'warga',
        kolom: 'namaArt',
        transform: 'teks',
        mode: 'isi_kosong',
        aktif: true,
        urutan: 0,
      },
    ]
    const konteks: KonteksAutofill = {
      wargaTerpilih: { nik: '123', namaArt: 'Test' },
    }
    const result = terapkanAutofill({
      answers,
      rules,
      konteks,
      triggerFieldId: 'cari_warga',
    })
    expect(result.changed).toBe(true)
    expect(result.answersBaru.nik).toBe('123')
    expect(result.answersBaru.nama).toBe('') // tidak diproses
  })
})
