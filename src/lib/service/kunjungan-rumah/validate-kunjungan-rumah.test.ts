import { describe, expect, it } from 'vitest'
import { createDefaultKunjunganRumahTemplates } from '@/lib/kunjungan-rumah/template/kunjungan-rumah-templates'
import { validateKunjunganRumah } from './validate-kunjungan-rumah'
import { validInput } from './kunjungan-rumah.fixture'

const templates = createDefaultKunjunganRumahTemplates()

describe('validateKunjunganRumah', () => {
  it('lolos untuk isian minimal valid', () => {
    const { ok, invalid } = validateKunjunganRumah(validInput())
    expect(ok).toBe(true)
    expect(invalid).toEqual({})
  })

  it('tolak info kosong + tanpa anggota + tanpa penilaian', () => {
    const input = validInput()
    input.info.tglPengumpulan = ''
    input.info.posyandu = ''
    input.anggota = []
    input.penilaian = []
    input.ttd = ''
    const { ok, invalid } = validateKunjunganRumah(input)
    expect(ok).toBe(false)
    expect(invalid.tgl).toBe(true)
    expect(invalid.posyandu).toBe(true)
    expect(invalid.anggota).toBe(true)
    expect(invalid.penilaian).toBe(true)
    expect(invalid.ttd).toBe(true)
  })

  it('tolak NIK sasaran utama yang tidak 16 digit', () => {
    const input = validInput()
    input.info.nik = '123'
    const res = validateKunjunganRumah(input)
    expect(res.ok).toBe(false)
    expect(res.invalid.nik).toBe(true)
  })

  it('tolak NIK duplikat dan NIK tidak 16 digit', () => {
    const input = validInput()
    input.anggota = [
      { ...input.anggota[0]!, id: 'a1' },
      { ...input.anggota[0]!, id: 'a2' },
    ]
    const dup = validateKunjunganRumah(input)
    expect(dup.ok).toBe(false)
    expect(dup.invalid['nik:a2']).toBe(true)

    const bad = validInput()
    bad.anggota[0]!.nik = '123'
    const res = validateKunjunganRumah(bad)
    expect(res.ok).toBe(false)
    expect(res.invalid['nik:a1']).toBe(true)
  })

  it('wajibkan jadwal saat hasil kontrol ulang', () => {
    const input = validInput()
    const kontrolUlang = templates.hasilOpsi[1]
    expect(kontrolUlang).toBeDefined()
    input.hasil = kontrolUlang as string
    input.jadwal = ''
    expect(validateKunjunganRumah(input).ok).toBe(false)
    input.jadwal = '2026-03-01'
    expect(validateKunjunganRumah(input).ok).toBe(true)
  })

  it('tolak hasil di luar opsi template', () => {
    const input = validInput()
    input.hasil = 'Hasil fiktif'
    const { ok, invalid } = validateKunjunganRumah(input)
    expect(ok).toBe(false)
    expect(invalid.hasil).toBe(true)
  })

  it('wajibkan minimal 1 foto dokumentasi', () => {
    const input = validInput()
    input.fotos = []
    const { ok, invalid } = validateKunjunganRumah(input)
    expect(ok).toBe(false)
    expect(invalid.fotos).toBe(true)
  })

  // Kolom `pekerjaan` di `data_warga` hanya ada di baris anggota, jadi form harus
  // punya anggota dengan NIK yang sama persis dengan NIK sasaran utama.
  it('tolak saat tidak ada anggota dengan NIK = NIK sasaran utama', () => {
    const input = validInput()
    input.anggota[0]!.nik = '3579011111111111'
    const { ok, invalid } = validateKunjunganRumah(input)
    expect(ok).toBe(false)
    expect(invalid.anggotaNik).toBe(true)
  })

  it('tolak pekerjaan anggota yang tidak dikenal enum data_warga', () => {
    const input = validInput()
    input.anggota[0]!.pekerjaan = 'nelayanJV'
    const { ok, invalid } = validateKunjunganRumah(input)
    expect(ok).toBe(false)
    expect(invalid['pekerjaan:a1']).toBe(true)
  })

  it('terima label pekerjaan versi pendek yang dipetakan ke enum', () => {
    const input = validInput()
    input.anggota[0]!.pekerjaan = 'Tidak bekerja'
    expect(validateKunjunganRumah(input).ok).toBe(true)
    input.anggota[0]!.pekerjaan = 'Swasta'
    expect(validateKunjunganRumah(input).ok).toBe(true)
  })
})
