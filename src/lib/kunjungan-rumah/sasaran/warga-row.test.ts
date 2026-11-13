import { describe, expect, it } from 'vitest'
import {
  anggotaKepalaKeluarga,
  barisDataWargaDariForm,
  keAgama,
  keHubunganKeluarga,
  keJenisKelamin,
  kePendidikan,
  kePekerjaan,
  keStatusKawin,
  opsiHubKK,
  opsiJk,
  opsiPendidikan,
  opsiPekerjaan,
} from './warga-row'
import type { SasaranSuggestion } from './warga-row'
import type {
  AnggotaKeluarga,
  KeluargaInfo,
} from '@/lib/kunjungan-rumah/models'

const info: KeluargaInfo = {
  tglPengumpulan: '2026-09-29',
  alamat: 'Jl. Laks Martadinata',
  kelurahan: 'Ngemplakrejo',
  kecamatan: 'Panggungrejo',
  kabKota: 'KOTA PASURUAN',
  provinsi: 'JAWA TIMUR',
  hpKK: '628123456789',
  puskesmas: 'Puskesmas Trajeng',
  pustu: '',
  posyandu: 'Mawar 2',
  namaKK: 'ZULKARNAIN',
  nik: '3575021105800002',
  rt: '2',
  rw: '6',
  petugasId: '3adb89c2-b947-48d7-af70-8a5523b1e323',
  petugasNama: 'Budi Santoso',
}

/** Nilai enum `data_warga_import` untuk WRG-000003, apa adanya dari DB. */
const suggestion: SasaranSuggestion = {
  rawId: 'WRG-000003',
  nik: '3575021105800002',
  namaArt: 'ZULKARNAIN',
  namaKk: 'ZULKARNAIN',
  hubunganKeluarga: 'Kepala Keluarga',
  tglLahir: '1980-05-11',
  jenisKelamin: 'laki-laki',
  statusKawin: 'kawin',
  agama: 'Islam',
  pendidikan: 'Tidak/Belum Sekolah',
  // "Belum/Tidak Bekerja" tidak ada di enum `pekerjaan` → dinormalkan jadi null.
  pekerjaan: null,
  alamat: 'JL LAKS MARTADINATA',
  rt: '2',
  rw: '6',
  kecamatan: 'PANGGUNGREJO',
  kelurahan: 'NGEMPLAKREJO',
  kabKota: 'KOTA PASURUAN',
  provinsi: 'JAWA TIMUR',
}

const kk: AnggotaKeluarga = {
  id: 'a1',
  nama: 'ZULKARNAIN',
  nik: '3575021105800002',
  tglLahir: '1980-05-11',
  jk: 'L',
  hubKK: 'Kepala Keluarga',
  statusKawin: 'Kawin',
  pendidikan: 'Tidak sekolah',
  pekerjaan: 'Tidak bekerja',
}

describe('normalisasi enum', () => {
  it('opsi form pendek -> label enum data_warga', () => {
    expect(keJenisKelamin('L')).toBe('laki-laki')
    expect(keJenisKelamin('P')).toBe('perempuan')
    expect(kePekerjaan('Swasta')).toBe('SWASTA')
    expect(kePekerjaan('Tidak bekerja')).toBe('Tidak Bekerja')
    expect(kePendidikan('SMA')).toBe('SLTA/Sederajat')
    expect(keStatusKawin('Kawin')).toBe('kawin')
    expect(keHubunganKeluarga('Orang tua')).toBe('Orang Tua')
  })

  it('label yang sudah Baku diteruskan tanpa diubah', () => {
    expect(keAgama('Islam')).toBe('Islam')
    expect(kePekerjaan('PNS')).toBe('PNS')
    expect(keJenisKelamin('perempuan')).toBe('perempuan')
  })

  it('nilai di luar enum ditolak, bukan diteruskan', () => {
    // 86% baris import punya `pekerjaan` yang tidak ada di enum.
    expect(kePekerjaan('Belum/Tidak Bekerja')).toBeNull()
    expect(kePekerjaan('Mengurus Rumah Tangga')).toBeNull()
    expect(keAgama('')).toBeNull()
    expect(keHubunganKeluarga('Keponakan')).toBeNull()
  })

  it('peta balik enum -> opsi form untuk mengisi select', () => {
    expect(opsiJk('laki-laki')).toBe('L')
    expect(opsiPekerjaan('Tidak Bekerja')).toBe('Tidak bekerja')
    // Label enum yang juga sah jadi opsi form harus punya pasangan, kalau tidak
    // `<select>` akan menampilkan kosong untuk nilai yang sebenarnya valid.
    expect(opsiHubKK('Kepala Keluarga')).toBe('Kepala Keluarga')
    expect(opsiPekerjaan('Nelayan')).toBe('Nelayan')
    // Sebaliknya, label enum tanpa opsi form (mis. "Belum Tamat SD/Sederajat")
    // dibiarkan kosong supaya staff memilih sendiri, bukan dipaksakan ke "SD".
    expect(opsiPendidikan('Diploma I/II')).toBe('')
    expect(opsiPendidikan('Belum Tamat SD/Sederajat')).toBe('')
  })
})

describe('anggotaKepalaKeluarga', () => {
  it('menemukan anggota dengan NIK sama dengan NIK sasaran utama', () => {
    expect(anggotaKepalaKeluarga([kk], '3575021105800002')).toBe(kk)
  })

  it('null saat tidak ada anggota yang NIK-nya cocok', () => {
    expect(anggotaKepalaKeluarga([kk], '3575029909900009')).toBeNull()
    expect(anggotaKepalaKeluarga([], '3575021105800002')).toBeNull()
  })
})

describe('barisDataWargaDariForm', () => {
  it('isi form + import menghasilkan baris siap insert', () => {
    const { nilai, hilang } = barisDataWargaDariForm({
      info,
      anggota: [kk],
      suggestion,
    })
    expect(hilang).toEqual([])
    expect(nilai).not.toBeNull()
    expect(nilai!.nik).toBe('3575021105800002')
    expect(nilai!.nama_art).toBe('ZULKARNAIN')
    // `pekerjaan` diambil dari anggota, bukan dari import yang nilainya null.
    expect(nilai!.pekerjaan).toBe('Tidak Bekerja')
    expect(nilai!.jenis_kelamin).toBe('laki-laki')
    expect(nilai!.status_kawin).toBe('kawin')
    expect(nilai!.pendidikan).toBe('Tidak/Belum Sekolah')
    expect(nilai!.agama).toBe('Islam')
    expect(nilai!.staff).toBe('3adb89c2-b947-48d7-af70-8a5523b1e323')
    // Tidak ada sumber di form maupun import.
    expect(nilai!.wanita_usia_hamil).toBe(false)
  })

  it('rt/rw/agama diambil dari import karena tidak ada di form', () => {
    const tanpaWilayah: KeluargaInfo = { ...info, rt: '', rw: '' }
    const { nilai } = barisDataWargaDariForm({
      info: tanpaWilayah,
      anggota: [kk],
      suggestion,
    })
    expect(nilai!.rt).toBe('2')
    expect(nilai!.rw).toBe('6')
    // `agama` hanya ada di import — tanpa suggestion, kolom ini jadi hilang.
    const tanpaAgama = barisDataWargaDariForm({
      info,
      anggota: [kk],
      suggestion: null,
    })
    expect(tanpaAgama.nilai).toBeNull()
    expect(tanpaAgama.hilang).toContain('agama')
  })

  it('isi form menang atas import saat keduanya punya nilai', () => {
    const hasil = barisDataWargaDariForm({ info, anggota: [kk], suggestion })
    expect(hasil.nilai!.alamat).toBe('Jl. Laks Martadinata')
    expect(hasil.nilai!.kota).toBe('KOTA PASURUAN')
  })

  it('NIK tidak 16 digit ditolak sebelum kolom lain dievaluasi', () => {
    const { nilai, hilang } = barisDataWargaDariForm({
      info: { ...info, nik: '123' },
      anggota: [],
      suggestion,
    })
    expect(nilai).toBeNull()
    expect(hilang).toEqual(['nik'])
  })

  it.each(['', '   '])(
    'NIK kosong atau hanya spasi dilaporkan sebagai nik',
    (nik) => {
      const { nilai, hilang } = barisDataWargaDariForm({
        info: { ...info, nik },
        anggota: [],
        suggestion,
      })
      expect(nilai).toBeNull()
      expect(hilang).toEqual(['nik'])
    },
  )

  it('tidak ada anggota dengan NIK sasaran utama -> anggota dilaporkan', () => {
    const { nilai, hilang } = barisDataWargaDariForm({
      info,
      anggota: [{ ...kk, nik: '3575029909900009' }],
      suggestion,
    })
    expect(nilai).toBeNull()
    expect(hilang).toContain('anggota')
  })

  it('kolom yang kosong dilaporkan, tidak ditebak', () => {
    const { nilai, hilang } = barisDataWargaDariForm({
      info: { ...info, alamat: '' },
      anggota: [{ ...kk, tglLahir: '' }],
      suggestion: null,
    })
    expect(nilai).toBeNull()
    expect(hilang).toEqual(
      expect.arrayContaining(['alamat', 'tgl_lahir', 'agama']),
    )
  })

  it('pekerjaan anggota yang tidak dikenal enum ikut dilaporkan', () => {
    const { nilai, hilang } = barisDataWargaDariForm({
      info,
      anggota: [{ ...kk, pekerjaan: 'nelayanJV' }],
      suggestion,
    })
    expect(nilai).toBeNull()
    expect(hilang).toContain('pekerjaan')
  })
})
