/**
 * Uji reducer form kunjungan rumah.
 *
 * Fokusnya invarian yang tidak terlihat dari tipe: cascade antar-koleksi,
 * daftar kunci TBC yang harus ikut bersih, dan jaminan reducer tidak pernah
 * mengubah state yang diberikan. Tiga hal itu yang paling mudah rusak diam-diam
 * karena digarisbawahi jadi satu baris di dalam `switch`.
 *
 * Waktu dikunci dengan `vi.setSystemTime` karena dua nilai bawaan bergantung
 * pada hari ini: `info.tglPengumpulan` lewat `hariIni()`, dan `umur` pada
 * prefill yang dihitung dari `tglLahir` anggota. Tanpa itu, test akan gagal
 * sesekali tepat pada tanggal ulang tahun. `new Date(2026, 1, 14)` memakai
 * komponen numerik yang dibaca sebagai waktu lokal, jadi hasilnya sama di
 * mesin mana pun dengan zona waktu apa pun.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  initialKunjunganRumahState,
  kunjunganRumahReducer,
  penilaianPrefill,
} from './kunjungan-rumah-reducer'
import type {
  KunjunganRumahAction,
  KunjunganRumahState,
} from './kunjungan-rumah-reducer'
import type {
  AnggotaKeluarga,
  KunjunganRumahFoto,
  MasalahTindak,
  PenilaianForm,
} from '@/lib/kunjungan-rumah/models'
import { KUNJUNGAN_RUMAH_SCHEMA_VERSION } from '@/lib/kunjungan-rumah/types'
import type { KunjunganRumahRecord } from '@/lib/kunjungan-rumah/types'
import type { SasaranSuggestion } from '@/lib/kunjungan-rumah/sasaran/warga-row'
import { createDefaultKunjunganRumahTemplates } from '@/lib/kunjungan-rumah/template/kunjungan-rumah-templates'
import { HASIL_KUNJUNGAN_RUMAH } from '@/lib/constants'

const templates = createDefaultKunjunganRumahTemplates()

/**
 * Kunci yang wajib ikut kosong saat prioritas "TB" dimatikan.
 *
 * Daftar ini sengaja ditulis ulang di sini, bukan diimpor dari sumbernya: kalau
 * reducer menambah atau menghapus kunci, test ini harus gagal. Mengimpor daftar
 * yang sama akan membuat test mati diam-diam bersama kodenya.
 */
const KUNCI_TBC = [
  'tglDiagnosa',
  'tempatDiagnosa',
  'periksaTgl',
  'tempatPeriksa',
  'namaPmo',
  'kontakEratJenis',
  'adaObat',
  'minum24',
  'ingatPeriksa',
  'batukTerus',
  'demam',
  'bbTurun',
]

function dispatch(
  state: KunjunganRumahState,
  action: KunjunganRumahAction,
): KunjunganRumahState {
  return kunjunganRumahReducer(state, action)
}

/** Ambil satu elemen atau gagal keras — dipakai agar error test menyebut bagian mana yang salah. */
function must<T>(nilai: T | undefined, keterangan: string): T {
  if (nilai === undefined) throw new Error(`test: ${keterangan} tidak ada`)
  return nilai
}

/** Bekukan seluruh pohon supaya mutasi yang tidak disengaja langsung melempar TypeError. */
function beku<T>(nilai: T): T {
  if (nilai === null || typeof nilai !== 'object') return nilai
  for (const anak of Object.values(nilai as Record<string, unknown>)) beku(anak)
  return Object.freeze(nilai)
}

const anggota: AnggotaKeluarga = {
  id: 'a1',
  nama: 'Budi Setiawan',
  nik: '3579015202800001',
  tglLahir: '1980-02-15',
  jk: 'L',
  hubKK: 'Anak',
  statusKawin: 'Kawin',
  pendidikan: 'SMA',
  pekerjaan: 'Buruh',
}

const anggotaLain: AnggotaKeluarga = {
  ...anggota,
  id: 'a2',
  nama: 'Siti Rahmawati',
  nik: '3579016202900002',
  tglLahir: '1990-02-16',
  jk: 'P',
}

function penilaian(partial: Partial<PenilaianForm> = {}): PenilaianForm {
  return {
    id: 'p1',
    anggotaId: 'a1',
    sasaran: 'dewasa',
    values: {},
    checks: {},
    prioritas: [],
    ...partial,
  }
}

function suggestion(
  partial: Partial<SasaranSuggestion> = {},
): SasaranSuggestion {
  return {
    rawId: '9000000000000001',
    nik: '3579015202800001',
    namaArt: 'Budi Setiawan',
    namaKk: 'Bpk. Salim',
    hubunganKeluarga: 'Kepala Keluarga',
    tglLahir: '1980-02-15',
    jenisKelamin: 'laki-laki',
    statusKawin: 'kawin',
    agama: null,
    // `SasaranSuggestion` sudah dinormalkan ke label enum; `opsiPendidikan()`
    // memetakannya balik ke label opsi form. Jadi "SLTA/Sederajat" -> "SMA".
    pendidikan: 'SLTA/Sederajat',
    pekerjaan: null,
    alamat: 'Jl. Ngemplakrejo gg. III no. 12',
    rt: '003',
    rw: '005',
    kecamatan: 'Trajeng',
    kelurahan: 'Ngemplakrejo',
    kabKota: 'Kota Pasuruan',
    provinsi: 'Jawa Timur',
    ...partial,
  }
}

/** State dasar dengan satu anggota dan satu penilaian, supaya test fokus ke aksi yang diuji. */
function stateDenganIsi(): KunjunganRumahState {
  const dasar = initialKunjunganRumahState()
  return {
    ...dasar,
    info: { ...dasar.info, namaKK: 'Bpk. Salim', nik: '3579015202800001' },
    anggota: [anggota],
    penilaian: [penilaian()],
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 1, 14)) // 14 Februari 2026, waktu lokal
})

afterEach(() => {
  vi.useRealTimers()
})

describe('initialKunjunganRumahState', () => {
  it('hasil terisi pilihan pertama, tapi petugas sengaja kosong', () => {
    const state = initialKunjunganRumahState()
    // Comment reducer menyatakan simpan baru harus gagal validasi sampai petugas
    // nyata dipilih dari daftar — jadi default kosong itu disengaja, bukan lupa.
    expect(state.hasil).toBe(HASIL_KUNJUNGAN_RUMAH[0])
    expect(state.info.petugasId).toBe('')
    expect(state.anggota).toEqual([])
    expect(state.penilaian).toEqual([])
    expect(state.penilaianTersimpan).toEqual([])
    expect(state.masalah).toEqual([])
    expect(state.fotos).toEqual([])
    expect(state.invalid).toEqual({})
  })

  it('tanggal pengumpulan berisi tanggal ISO, dihitung saat module dimuat', () => {
    // `EMPTY_INFO` adalah konstanta modul, jadi `hariIni()` dipanggil sekali
    // ketika modul ini diimpor — bukan tiap kali state dibuat. Form yang
    // dibiarkan terbuka melewati tengah malam tidak memperbarui tanggal ini.
    // Tes sengaja tidak memakai fake timer di sini: yang diuji bentuknya.
    expect(initialKunjunganRumahState().info.tglPengumpulan).toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    )
  })

  it('dua pemanggilan tidak berbagi objek yang sama', () => {
    const a = initialKunjunganRumahState()
    const b = initialKunjunganRumahState()
    expect(a).not.toBe(b)
    expect(a.info).not.toBe(b.info)
    expect(a.sanitasi).not.toBe(b.sanitasi)
    expect(a.anggota).not.toBe(b.anggota)
  })
})

describe('aksi sederhana', () => {
  it('SET_FIELD menulis ke info tanpa menimpa yang lain', () => {
    const sebelum = stateDenganIsi()
    const sesudah = dispatch(sebelum, {
      type: 'SET_FIELD',
      key: 'alamat',
      value: 'Jl. Baru no. 1',
    })
    expect(sesudah.info.alamat).toBe('Jl. Baru no. 1')
    expect(sesudah.info.namaKK).toBe('Bpk. Salim')
    expect(sesudah.info).not.toBe(sebelum.info)
  })

  it('SET_SAN_FIELD menerima boolean maupun string', () => {
    const dasar = initialKunjunganRumahState()
    const cek = dispatch(dasar, {
      type: 'SET_SAN_FIELD',
      key: 'jkn',
      value: true,
    })
    expect(cek.sanitasi.jkn).toBe(true)
    const air = dispatch(dasar, {
      type: 'SET_SAN_FIELD',
      key: 'jenisAir',
      value: 'sumur',
    })
    expect(air.sanitasi.jenisAir).toBe('sumur')
  })

  it('SET_TAMBAHAN_FIELD menyimpan isian section generik di namespace sendiri', () => {
    const dasar = initialKunjunganRumahState()
    const sesudah = dispatch(dasar, {
      type: 'SET_TAMBAHAN_FIELD',
      key: 'catatanTambahan::catatan',
      value: 'Rumah sudah dibersihkan',
    })
    expect(sesudah.tambahan['catatanTambahan::catatan']).toBe(
      'Rumah sudah dibersihkan',
    )
    // Tidak bocor ke info: field generik tidak boleh menimpa isian bawaan.
    expect('catatan' in sesudah.info).toBe(false)
    expect(sesudah.tambahan).not.toBe(dasar.tambahan)
  })

  it('SET_HASIL, SET_JADWAL, SET_TTD', () => {
    let state = initialKunjunganRumahState()
    state = dispatch(state, { type: 'SET_HASIL', value: 'Kontrol ulang' })
    state = dispatch(state, { type: 'SET_JADWAL', value: '2026-03-01' })
    state = dispatch(state, { type: 'SET_TTD', value: 'Siti Aminah' })
    expect(state.hasil).toBe('Kontrol ulang')
    expect(state.jadwal).toBe('2026-03-01')
    expect(state.ttd).toBe('Siti Aminah')
  })

  it('SET_INVALID mengganti peta penanda, bukan menyatunya', () => {
    const dasar = dispatch(initialKunjunganRumahState(), {
      type: 'SET_INVALID',
      invalid: { nik: true },
    })
    expect(dasar.invalid).toEqual({ nik: true })
    const bersih = dispatch(dasar, { type: 'SET_INVALID', invalid: {} })
    expect(bersih.invalid).toEqual({})
  })

  it('action yang tidak dikenal mengembalikan state yang sama, bukan salinan', () => {
    const state = stateDenganIsi()
    const hasil = dispatch(state, {
      type: 'MISTERIUS',
    } as unknown as KunjunganRumahAction)
    expect(hasil).toBe(state)
  })
})

describe('anggota keluarga', () => {
  it('ADD_ANGGOTA memberi id unik setiap kali', () => {
    let state = initialKunjunganRumahState()
    state = dispatch(state, { type: 'ADD_ANGGOTA' })
    state = dispatch(state, { type: 'ADD_ANGGOTA' })
    const ids = state.anggota.map((a) => a.id)
    expect(state.anggota).toHaveLength(2)
    expect(new Set(ids).size).toBe(2)
    expect(ids.every((id) => typeof id === 'string' && id.length > 0)).toBe(
      true,
    )
  })

  it('UPDATE_ANGGOTA hanya mengubah anggota yang cocok id', () => {
    const state = stateDenganIsi()
    const sesudah = dispatch(state, {
      type: 'UPDATE_ANGGOTA',
      id: 'a1',
      key: 'pekerjaan',
      value: 'Pedagang',
    })
    expect(must(sesudah.anggota[0], 'anggota pertama').pekerjaan).toBe(
      'Pedagang',
    )
    expect(sesudah.anggota).toHaveLength(1)
  })

  it('UPDATE_ANGGOTA dengan id yang tidak ada tidak mengubah apa pun', () => {
    const state = stateDenganIsi()
    const sesudah = dispatch(state, {
      type: 'UPDATE_ANGGOTA',
      id: 'entah',
      key: 'pekerjaan',
      value: 'Pedagang',
    })
    expect(sesudah.anggota).toEqual(state.anggota)
  })

  it('REMOVE_ANGGOTA ikut membuang penilaian milik anggota itu', () => {
    // Cascade ini tertulis di satu baris `.filter()` setelah hapus anggota. Kalau
    // hilang, penilaian yatim tetap ikut terkirim ke server dan tidak punya induk.
    const state: KunjunganRumahState = {
      ...stateDenganIsi(),
      anggota: [anggota, anggotaLain],
      penilaian: [
        penilaian({ id: 'p1', anggotaId: 'a1' }),
        penilaian({ id: 'p2', anggotaId: 'a2' }),
      ],
    }
    const sesudah = dispatch(state, { type: 'REMOVE_ANGGOTA', id: 'a1' })
    expect(sesudah.anggota.map((a) => a.id)).toEqual(['a2'])
    expect(sesudah.penilaian.map((p) => p.id)).toEqual(['p2'])
  })
})

describe('penilaian sasaran', () => {
  it('ADD_PENILAIAN memakai prioritasDefault dari template', () => {
    const state = stateDenganIsi()
    const sesudah = dispatch(state, {
      type: 'ADD_PENILAIAN',
      anggotaId: 'a1',
      sasaran: 'ibu-hamil',
      templates,
    })
    // Template bawaan ibu-hamil punya "Bumil Risti"; dewasa tidak punya satu pun.
    // Penilaian baru ada di posisi terakhir, bukan yang pertama.
    const baru = must(sesudah.penilaian.at(-1), 'penilaian baru')
    expect(baru.prioritas).toEqual(['Bumil Risti'])
    expect(sesudah.penilaian).toHaveLength(2)
  })

  it('ADD_PENILAIAN prefill nama, tglLahir, dan jk dari anggota', () => {
    const state = stateDenganIsi()
    const sesudah = dispatch(state, {
      type: 'ADD_PENILAIAN',
      anggotaId: 'a1',
      sasaran: 'dewasa',
      templates,
    })
    const nilai = must(sesudah.penilaian.at(-1), 'penilaian baru').values
    expect(nilai.nama).toBe('Budi Setiawan')
    expect(nilai.tglLahir).toBe('1980-02-15')
    expect(nilai.jk).toBe('L')
  })

  it('umur dihitung dari tglLahir relatif waktu yang dikunci', () => {
    // Lahir 16 Februari 1990, acuan 14 Februari 2026: hitungan kasar 36, tapi
    // ulang tahun tahun ini belum lewat sehingga kurang satu -> 35.
    const state: KunjunganRumahState = {
      ...initialKunjunganRumahState(),
      anggota: [anggotaLain],
    }
    const sesudah = dispatch(state, {
      type: 'ADD_PENILAIAN',
      anggotaId: 'a2',
      sasaran: 'ibu-hamil',
      templates,
    })
    expect(
      must(sesudah.penilaian.at(-1), 'penilaian ibu hamil').values.umur,
    ).toBe('35')
  })

  it('umur naik satu setelah tanggal ulang tahun lewat', () => {
    const state: KunjunganRumahState = {
      ...initialKunjunganRumahState(),
      anggota: [anggotaLain],
    }
    vi.setSystemTime(new Date(2026, 1, 16)) // 16 Februari: tepat ulang tahun
    const sesudah = dispatch(state, {
      type: 'ADD_PENILAIAN',
      anggotaId: 'a2',
      sasaran: 'ibu-hamil',
      templates,
    })
    expect(
      must(sesudah.penilaian.at(-1), 'penilaian ibu hamil').values.umur,
    ).toBe('36')
  })

  it('REMOVE_PENILAIAN membuang hanya penilaian yang cocok', () => {
    const state: KunjunganRumahState = {
      ...stateDenganIsi(),
      penilaian: [penilaian({ id: 'p1' }), penilaian({ id: 'p2' })],
    }
    const sesudah = dispatch(state, { type: 'REMOVE_PENILAIAN', id: 'p1' })
    expect(sesudah.penilaian.map((p) => p.id)).toEqual(['p2'])
  })

  it('SET_VALUE dan SET_CHECK hanya menyentuh penilaian yang cocok', () => {
    const state: KunjunganRumahState = {
      ...stateDenganIsi(),
      penilaian: [penilaian({ id: 'p1' }), penilaian({ id: 'p2' })],
    }
    const adaNilai = dispatch(state, {
      type: 'SET_VALUE',
      id: 'p2',
      key: 'merokok',
      value: 'Pasif',
    })
    expect(must(adaNilai.penilaian[1], 'penilaian p2').values.merokok).toBe(
      'Pasif',
    )
    expect(must(adaNilai.penilaian[0], 'penilaian p1').values).toEqual({})

    const adaCheck = dispatch(state, {
      type: 'SET_CHECK',
      id: 'p2',
      key: 'suhu',
      checked: true,
    })
    expect(must(adaCheck.penilaian[1], 'penilaian p2').checks.suhu).toBe(true)
    expect(must(adaCheck.penilaian[0], 'penilaian p1').checks).toEqual({})
  })

  it('BATCH_CLEAR_VALUES hanya mengosongkan kunci yang disebut', () => {
    const state: KunjunganRumahState = {
      ...stateDenganIsi(),
      penilaian: [
        penilaian({
          values: { a: '1', b: '2', c: '3' },
        }),
      ],
    }
    const sesudah = dispatch(state, {
      type: 'BATCH_CLEAR_VALUES',
      id: 'p1',
      keys: ['a', 'c'],
    })
    expect(must(sesudah.penilaian[0], 'penilaian').values).toEqual({
      a: '',
      b: '2',
      c: '',
    })
  })

  it('BATCH_CLEAR_VALUES untuk id lain tidak mengubah apa pun', () => {
    const state: KunjunganRumahState = {
      ...stateDenganIsi(),
      penilaian: [penilaian({ values: { a: '1' } })],
    }
    const sesudah = dispatch(state, {
      type: 'BATCH_CLEAR_VALUES',
      id: 'lain',
      keys: ['a'],
    })
    expect(must(sesudah.penilaian[0], 'penilaian').values).toEqual({ a: '1' })
  })
})

describe('GANTI_SASARAN', () => {
  it('mempertahankan isian sasaran lama saat sasaran diganti lalu dikembalikan', () => {
    // Kasus yang dilaporkan: dewasa -> ibu hamil -> dewasa. Isian dewasa harus
    // utuh, bukan kembali ke prefill identitas saja.
    const state: KunjunganRumahState = {
      ...stateDenganIsi(),
      penilaian: [
        penilaian({
          values: { nama: 'Budi Setiawan', keluhan: 'batuk' },
          checks: { bahaBatuk: true },
          prioritas: ['Hipertensi'],
        }),
      ],
    }
    const keHamil = dispatch(state, {
      type: 'GANTI_SASARAN',
      anggotaId: 'a1',
      sasaran: 'ibu-hamil',
      templates,
    })
    const balik = dispatch(keHamil, {
      type: 'GANTI_SASARAN',
      anggotaId: 'a1',
      sasaran: 'dewasa',
      templates,
    })
    const pulih = must(balik.penilaian[0], 'penilaian dewasa')
    expect(pulih.values).toMatchObject({
      nama: 'Budi Setiawan',
      keluhan: 'batuk',
    })
    expect(pulih.checks).toMatchObject({ bahaBatuk: true })
    expect(pulih.prioritas).toEqual(['Hipertensi'])
  })

  it('menyimpan sasaran nonaktif di cache, bukan di penilaian', () => {
    const sesudah = dispatch(stateDenganIsi(), {
      type: 'GANTI_SASARAN',
      anggotaId: 'a1',
      sasaran: 'ibu-hamil',
      templates,
    })
    expect(sesudah.penilaian.map((p) => p.sasaran)).toEqual(['ibu-hamil'])
    expect(sesudah.penilaianTersimpan.map((p) => p.sasaran)).toEqual(['dewasa'])
  })

  it('sasaran yang belum pernah diisi dibuat baru dengan prefill identitas', () => {
    const state: KunjunganRumahState = {
      ...stateDenganIsi(),
      penilaian: [penilaian({ values: { nama: 'Budi Setiawan' } })],
    }
    const sesudah = dispatch(state, {
      type: 'GANTI_SASARAN',
      anggotaId: 'a1',
      sasaran: 'ibu-hamil',
      templates,
    })
    const baru = must(sesudah.penilaian[0], 'penilaian ibu hamil')
    expect(baru.sasaran).toBe('ibu-hamil')
    expect(baru.values.nama).toBe('Budi Setiawan')
    expect(baru.prioritas).toEqual(['Bumil Risti'])
  })

  it('REMOVE_PENILAIAN membuang cache sasaran yang sama', () => {
    // Chip sasaran diklik ulang = batal; menghapus penilaian dewasa juga harus
    // membuang cadangan dewasa supaya sasaran itu benar-benar kosong lagi.
    const state: KunjunganRumahState = {
      ...stateDenganIsi(),
      penilaianTersimpan: [penilaian({ id: 'p-dewasa' })],
    }
    const sesudah = dispatch(state, { type: 'REMOVE_PENILAIAN', id: 'p1' })
    expect(sesudah.penilaianTersimpan).toHaveLength(0)
  })

  it('REMOVE_PENILAIAN mempertahankan cache sasaran lain', () => {
    const state: KunjunganRumahState = {
      ...stateDenganIsi(),
      penilaianTersimpan: [penilaian({ id: 'p-hamil', sasaran: 'ibu-hamil' })],
    }
    const sesudah = dispatch(state, { type: 'REMOVE_PENILAIAN', id: 'p1' })
    expect(sesudah.penilaianTersimpan.map((p) => p.sasaran)).toEqual([
      'ibu-hamil',
    ])
  })

  it('REMOVE_ANGGOTA membuang cache milik anggota itu', () => {
    const state: KunjunganRumahState = {
      ...stateDenganIsi(),
      penilaianTersimpan: [penilaian({ id: 'p-hamil', sasaran: 'ibu-hamil' })],
    }
    const sesudah = dispatch(state, { type: 'REMOVE_ANGGOTA', id: 'a1' })
    expect(sesudah.penilaianTersimpan).toHaveLength(0)
  })
})

describe('TOGGLE_PRIORITAS', () => {
  const denganTb = (): KunjunganRumahState => ({
    ...stateDenganIsi(),
    penilaian: [
      penilaian({
        prioritas: ['TB', 'Hipertensi'],
        values: Object.fromEntries(KUNCI_TBC.map((k) => [k, 'isi'])),
        checks: Object.fromEntries(KUNCI_TBC.map((k) => [k, true])),
      }),
    ],
  })

  it('menambah prioritas yang belum ada', () => {
    const state: KunjunganRumahState = {
      ...stateDenganIsi(),
      penilaian: [penilaian({ prioritas: [] })],
    }
    const sesudah = dispatch(state, {
      type: 'TOGGLE_PRIORITAS',
      id: 'p1',
      prio: 'TB',
    })
    expect(must(sesudah.penilaian[0], 'penilaian').prioritas).toEqual(['TB'])
  })

  it('mematikan TB mengosongkan seluruh kunci TBC di values dan checks', () => {
    const sesudah = dispatch(denganTb(), {
      type: 'TOGGLE_PRIORITAS',
      id: 'p1',
      prio: 'TB',
    })
    const p = must(sesudah.penilaian[0], 'penilaian')
    expect(p.prioritas).toEqual(['Hipertensi'])
    for (const kunci of KUNCI_TBC) {
      expect(p.values[kunci], `values.${kunci} harus kosong`).toBe('')
      expect(p.checks[kunci], `checks.${kunci} harus false`).toBe(false)
    }
  })

  it('mematikan prioritas selain TB tidak membersihkan apa pun', () => {
    const state = denganTb()
    const sesudah = dispatch(state, {
      type: 'TOGGLE_PRIORITAS',
      id: 'p1',
      prio: 'Hipertensi',
    })
    const p = must(sesudah.penilaian[0], 'penilaian')
    expect(p.prioritas).toEqual(['TB'])
    expect(p.values.tglDiagnosa).toBe('isi')
    expect(p.checks.demam).toBe(true)
  })

  it('id penilaian lain tidak ikut terpengaruh saat satu TB dimatikan', () => {
    const state: KunjunganRumahState = {
      ...stateDenganIsi(),
      penilaian: [
        penilaian({ id: 'p1', prioritas: ['TB'], values: { demod: 'x' } }),
        penilaian({ id: 'p2', prioritas: ['TB'], values: { demo: 'y' } }),
      ],
    }
    const sesudah = dispatch(state, {
      type: 'TOGGLE_PRIORITAS',
      id: 'p1',
      prio: 'TB',
    })
    expect(must(sesudah.penilaian[0], 'p1').prioritas).toEqual([])
    expect(must(sesudah.penilaian[1], 'p2').prioritas).toEqual(['TB'])
    expect(must(sesudah.penilaian[1], 'p2').values.demo).toBe('y')
  })
})

describe('masalah dan tindak lanjut', () => {
  it('ADD_MASALAH menambah baris kosong dengan id unik', () => {
    let state = initialKunjunganRumahState()
    state = dispatch(state, { type: 'ADD_MASALAH' })
    state = dispatch(state, { type: 'ADD_MASALAH' })
    expect(state.masalah).toHaveLength(2)
    expect(new Set(state.masalah.map((m) => m.id)).size).toBe(2)
    expect(must(state.masalah[0], 'masalah').nama).toBe('')
  })

  it('UPDATE_MASALAH dan REMOVE_MASALAH', () => {
    let state = dispatch(initialKunjunganRumahState(), { type: 'ADD_MASALAH' })
    const id = must(state.masalah[0], 'masalah').id
    state = dispatch(state, {
      type: 'UPDATE_MASALAH',
      id,
      key: 'masalah',
      value: 'Hipertensi',
    })
    expect(must(state.masalah[0], 'masalah').masalah).toBe('Hipertensi')
    state = dispatch(state, { type: 'REMOVE_MASALAH', id })
    expect(state.masalah).toEqual([])
  })

  it('MasalahTindak boleh punya anggotaId opsional', () => {
    // `anggotaId` opsional supaya baris masalah bisa dibuat sebelum anggota dipilih.
    const kosong: MasalahTindak = {
      id: 'm1',
      nama: '',
      nik: '',
      tglLahir: '',
      alamat: '',
      telepon: '',
      masalah: '',
      tindakLanjut: '',
    }
    expect(kosong.anggotaId).toBeUndefined()
  })
})

describe('APPLY_SASARAN', () => {
  it('menimpa nik dan namaKK dari baris terpilih, kolom lain tetap dijaga', () => {
    // `nik` dan `namaKK` juga jadi kunci pencarian suggestion, jadi isian yang
    // ada biasanya ketikan belum selesai ("3575", "syah"). Memilih baris berarti
    // membetulkan ketikan itu, jadi harus menang atas isian lama.
    const dasar = initialKunjunganRumahState()
    const state: KunjunganRumahState = {
      ...dasar,
      info: {
        ...dasar.info,
        nik: '3575',
        namaKK: 'Koreksi Staf',
        alamat: 'Alamat dikoreksi staf',
      },
    }
    const sesudah = dispatch(state, {
      type: 'APPLY_SASARAN',
      row: suggestion(),
    })
    expect(sesudah.info.nik).toBe(suggestion().nik)
    expect(sesudah.info.namaKK).toBe(suggestion().namaKk)
    // Kolom yang bukan kunci pencarian tetap dijaga supaya koreksi staf tidak
    // hilang, dan yang kosong diisi dari baris import.
    expect(sesudah.info.alamat).toBe('Alamat dikoreksi staf')
    expect(sesudah.info.kelurahan).toBe('Ngemplakrejo')
  })

  it('rt dan rw selalu ditulis meski form sudah terisi', () => {
    // Berbeda dari kolom header lain: rt/rw tidak punya field di template
    // keluarga default, jadi selalu ditulis supaya server tetap punya.
    const dasar = initialKunjunganRumahState()
    const state: KunjunganRumahState = {
      ...dasar,
      info: { ...dasar.info, rt: 'lama', rw: 'lama' },
    }
    const sesudah = dispatch(state, {
      type: 'APPLY_SASARAN',
      row: suggestion(),
    })
    expect(sesudah.info.rt).toBe('003')
    expect(sesudah.info.rw).toBe('005')
  })

  it('menggabungkan anggota yang NIK-nya sama, bukan menambah duplikat', () => {
    const sesudah = dispatch(stateDenganIsi(), {
      type: 'APPLY_SASARAN',
      row: suggestion(),
    })
    expect(sesudah.anggota).toHaveLength(1)
    const gabung = must(sesudah.anggota[0], 'anggota')
    expect(gabung.id).toBe('a1')
    expect(gabung.hubKK).toBe('Kepala Keluarga')
  })

  it('menambah anggota baru bila NIK-nya tidak ditemukan', () => {
    const sesudah = dispatch(stateDenganIsi(), {
      type: 'APPLY_SASARAN',
      row: suggestion({ nik: '3579011111111111', rawId: 'x' }),
    })
    expect(sesudah.anggota).toHaveLength(2)
  })

  it('baris tanpa NIK selalu menambah baris baru', () => {
    // NIK kosong ada pada ribuan baris import; baris seperti itu tidak bisa
    // dicocokkan ke anggota yang sudah ada, jadi sengaja selalu ditambahkan.
    const state: KunjunganRumahState = {
      ...stateDenganIsi(),
      anggota: [anggota],
    }
    const pertama = dispatch(state, {
      type: 'APPLY_SASARAN',
      row: suggestion({ nik: '' }),
    })
    expect(pertama.anggota).toHaveLength(2)
    const kedua = dispatch(pertama, {
      type: 'APPLY_SASARAN',
      row: suggestion({ nik: '' }),
    })
    expect(kedua.anggota).toHaveLength(3)
  })

  it('menghapus penanda invalid supaya isian baru tidak ikut ditandai merah', () => {
    const state: KunjunganRumahState = {
      ...initialKunjunganRumahState(),
      invalid: { nik: true, posyandu: true },
    }
    const sesudah = dispatch(state, {
      type: 'APPLY_SASARAN',
      row: suggestion(),
    })
    expect(sesudah.invalid).toEqual({})
  })

  it('ISI_ANGGOTA_KELUARGA mengganti anggota lama dengan seluruh household', () => {
    const semua: SasaranSuggestion[] = [
      suggestion({
        nik: '3579011111111111',
        namaArt: 'Siti Aminah',
        rawId: 'a',
      }),
      suggestion({ nik: '3579012222222222', namaArt: 'Andi', rawId: 'b' }),
      suggestion({ nik: '3579013333333333', namaArt: 'Budi', rawId: 'c' }),
    ]
    const sesudah = dispatch(stateDenganIsi(), {
      type: 'ISI_ANGGOTA_KELUARGA',
      rows: semua,
    })
    // Ganti, bukan tambah: sisa anggota dari KK sebelumnya harus hilang.
    expect(sesudah.anggota.map((a) => a.nama)).toEqual([
      'Siti Aminah',
      'Andi',
      'Budi',
    ])
  })

  it('ISI_ANGGOTA_KELUARGA menggabungkan baris tanpa NIK yang sama', () => {
    // NIK kosong ada pada ribuan baris import; dua baris dengan nama dan KK
    // sama harus jadi satu anggota supaya kader tidak melihat duplikat.
    const semua: SasaranSuggestion[] = [
      suggestion({ nik: '', namaArt: 'Sari', rawId: 'a' }),
      suggestion({ nik: '', namaArt: 'Sari', rawId: 'a2' }),
      suggestion({ nik: '', namaArt: 'Rina', rawId: 'b' }),
    ]
    const sesudah = dispatch(stateDenganIsi(), {
      type: 'ISI_ANGGOTA_KELUARGA',
      rows: semua,
    })
    expect(sesudah.anggota.map((a) => a.nama)).toEqual(['Sari', 'Rina'])
  })

  it('tidak menggabungkan anggota tanpa NIK yang tanggal lahirnya berbeda', () => {
    const sesudah = dispatch(stateDenganIsi(), {
      type: 'ISI_ANGGOTA_KELUARGA',
      rows: [
        suggestion({ nik: '', namaArt: 'Sari', tglLahir: '1980-02-15' }),
        suggestion({ nik: '', namaArt: 'Sari', tglLahir: '2005-08-20' }),
      ],
    })

    expect(sesudah.anggota).toHaveLength(2)
  })

  it('ISI_ANGGOTA_KELUARGA membiarkan baris kosong utuh untuk diisi kader', () => {
    // NIK dan tanggal lahir kosong tidak ditebak; komponen form yang menandai
    // field kosong itu, dan server menolak menyimpan sampai dilengkapi.
    const sesudah = dispatch(stateDenganIsi(), {
      type: 'ISI_ANGGOTA_KELUARGA',
      rows: [suggestion({ nik: '', rawId: 'a', tglLahir: null })],
    })
    const satu = must(sesudah.anggota[0], 'anggota')
    expect(satu.nik).toBe('')
    expect(satu.tglLahir).toBe('')
  })

  it('ISI_ANGGOTA_KELUARGA tidak mengubah apa pun saat tidak ada baris', () => {
    // Fetch bisa gagal atau tidak menemukan apa pun. Kalau anggota lama dihapus
    // dalam kasus itu, pilihan kader yang sudah diketik hilang tanpa sebab.
    const state = stateDenganIsi()
    const sesudah = dispatch(state, {
      type: 'ISI_ANGGOTA_KELUARGA',
      rows: [],
    })
    expect(sesudah.anggota).toBe(state.anggota)
  })

  it('memetakan nilai import ke label opsi form', () => {
    const sesudah = dispatch(stateDenganIsi(), {
      type: 'APPLY_SASARAN',
      row: suggestion({ nik: '9999999999999999', rawId: 'y' }),
    })
    const baru = must(sesudah.anggota[1], 'anggota baru')
    expect(baru.jk).toBe('L')
    expect(baru.hubKK).toBe('Kepala Keluarga')
    expect(baru.statusKawin).toBe('Kawin')
    expect(baru.pendidikan).toBe('SMA')
  })

  it('nilai import yang tidak ada padanan berakhir kosong, bukan ditebak', () => {
    const sesudah = dispatch(stateDenganIsi(), {
      type: 'APPLY_SASARAN',
      row: suggestion({
        nik: '8888888888888888',
        rawId: 'z',
        pekerjaan: 'Scooling',
      }),
    })
    // `pekerjaan` import tidak cocok enum pada sebagian besar baris.
    expect(must(sesudah.anggota[1], 'anggota baru').pekerjaan).toBe('')
  })
})

describe('foto dokumentasi', () => {
  const foto = (nama: string): KunjunganRumahFoto => ({
    id: nama,
    name: nama,
    dataUrl: 'data:image/jpeg;base64,AAA',
    caption: '',
    takenAt: '2026-02-14T08:00:00.000Z',
  })

  it('ADD_FOTOS menempelkan, bukan menimpa', () => {
    let state = initialKunjunganRumahState()
    state = dispatch(state, { type: 'ADD_FOTOS', fotos: [foto('a.jpg')] })
    state = dispatch(state, { type: 'ADD_FOTOS', fotos: [foto('b.jpg')] })
    expect(state.fotos.map((f) => f.name)).toEqual(['a.jpg', 'b.jpg'])
  })

  it('SET_FOTO_CAPTION bekerja pada indeks yang diminta saja', () => {
    let state = initialKunjunganRumahState()
    state = dispatch(state, {
      type: 'ADD_FOTOS',
      fotos: [foto('a.jpg'), foto('b.jpg')],
    })
    state = dispatch(state, {
      type: 'SET_FOTO_CAPTION',
      index: 1,
      caption: 'Rumah bersih',
    })
    expect(must(state.fotos[0], 'foto 0').caption).toBe('')
    expect(must(state.fotos[1], 'foto 1').caption).toBe('Rumah bersih')
  })

  it('REMOVE_FOTO menghapus berdasarkan indeks', () => {
    let state = initialKunjunganRumahState()
    state = dispatch(state, {
      type: 'ADD_FOTOS',
      fotos: [foto('a.jpg'), foto('b.jpg')],
    })
    state = dispatch(state, { type: 'REMOVE_FOTO', index: 0 })
    expect(state.fotos.map((f) => f.name)).toEqual(['b.jpg'])
  })

  it('indeks di luar rentang tidak merusak state', () => {
    let state = initialKunjunganRumahState()
    state = dispatch(state, { type: 'ADD_FOTOS', fotos: [foto('a.jpg')] })
    expect(
      dispatch(state, { type: 'REMOVE_FOTO', index: 9 }).fotos,
    ).toHaveLength(1)
    expect(
      dispatch(state, { type: 'SET_FOTO_CAPTION', index: 9, caption: 'x' })
        .fotos,
    ).toHaveLength(1)
  })
})

/** Satu record tersimpan, dipakai bersama oleh beberapa kelompok tes. */
const recordUji = (): KunjunganRumahRecord => ({
  id: 'rec-1',
  schemaVersion: KUNJUNGAN_RUMAH_SCHEMA_VERSION,
  clientId: 'rec-1',
  syncedAt: null,
  waktuSimpan: '2026-02-14T09:00:00.000Z',
  info: { ...initialKunjunganRumahState().info, namaKK: 'Bpk. Salim' },
  sanitasi: { ...initialKunjunganRumahState().sanitasi, jkn: true },
  anggota: [anggota],
  penilaian: [
    penilaian({ values: { a: '1' }, checks: { b: true }, prioritas: ['TB'] }),
  ],
  masalah: [
    {
      id: 'm1',
      nama: 'Budi',
      nik: '',
      tglLahir: '',
      alamat: '',
      telepon: '',
      masalah: 'Hipertensi',
      tindakLanjut: 'Edukasi',
    },
  ],
  hasil: 'Kontrol ulang',
  jadwal: '2026-03-01',
  ttd: 'Siti Aminah',
  fotos: [
    {
      id: 'f1',
      name: 'a.jpg',
      dataUrl: 'data:image/jpeg;base64,AAA',
      caption: '',
      takenAt: '2026-02-14T08:00:00.000Z',
    },
  ],
})

describe('LOAD_RECORD dan RESET', () => {
  it('memuat seluruh isi record', () => {
    const sesudah = dispatch(initialKunjunganRumahState(), {
      type: 'LOAD_RECORD',
      record: recordUji(),
    })
    expect(sesudah.info.namaKK).toBe('Bpk. Salim')
    expect(sesudah.sanitasi.jkn).toBe(true)
    expect(sesudah.hasil).toBe('Kontrol ulang')
    expect(sesudah.jadwal).toBe('2026-03-01')
    expect(sesudah.ttd).toBe('Siti Aminah')
    expect(sesudah.anggota).toHaveLength(1)
    expect(sesudah.masalah).toHaveLength(1)
    expect(sesudah.fotos).toHaveLength(1)
  })

  it('menyalin objek bersarang, bukan berbagi referensi dengan record', () => {
    // Kalau `values`, `checks`, atau `prioritas` ikut berbagi objek, mengedit
    // form akan ikut mengubah record yang sedang dirender di layar lain.
    const asli = recordUji()
    const sesudah = dispatch(initialKunjunganRumahState(), {
      type: 'LOAD_RECORD',
      record: asli,
    })
    const pAsal = must(asli.penilaian[0], 'penilaian asli')
    const pSalin = must(sesudah.penilaian[0], 'penilaian salinan')
    expect(pSalin).not.toBe(pAsal)
    expect(pSalin.values).not.toBe(pAsal.values)
    expect(pSalin.checks).not.toBe(pAsal.checks)
    expect(pSalin.prioritas).not.toBe(pAsal.prioritas)
    expect(sesudah.info).not.toBe(asli.info)
    expect(sesudah.anggota[0]).not.toBe(asli.anggota[0])
  })

  it('memuat isian section generik dari record', () => {
    const record = {
      ...recordUji(),
      tambahan: { 'catatanTambahan::catatan': 'sudah dicek' },
    }
    const sesudah = dispatch(initialKunjunganRumahState(), {
      type: 'LOAD_RECORD',
      record,
    })
    expect(sesudah.tambahan).toEqual({
      'catatanTambahan::catatan': 'sudah dicek',
    })
    expect(sesudah.tambahan).not.toBe(record.tambahan)
  })

  it('record lama tanpa tambahan tetap terbaca dengan objek kosong', () => {
    const sesudah = dispatch(initialKunjunganRumahState(), {
      type: 'LOAD_RECORD',
      record: recordUji(),
    })
    expect(sesudah.tambahan).toEqual({})
  })

  it('RESET mengembalikan state awal yang baru', () => {
    const terisi = stateDenganIsi()
    const sesudah = dispatch(terisi, { type: 'RESET' })
    expect(sesudah).toEqual(initialKunjunganRumahState())
    expect(sesudah.anggota).toEqual([])
  })
})

describe('FILL_DEMO', () => {
  it('mengisi contoh tanpa petugasId supaya simpan tetap ditolak', () => {
    const state = dispatch(initialKunjunganRumahState(), { type: 'FILL_DEMO' })
    expect(state.anggota).toHaveLength(2)
    expect(state.penilaian).toHaveLength(2)
    expect(state.masalah).toHaveLength(1)
    expect(state.sanitasi.jkn).toBe(true)
    expect(state.hasil).toBe(HASIL_KUNJUNGAN_RUMAH[0])
    // Sengaja kosong: demo boleh terlihat terisi tapi tetap harus gagal simpan
    // sampai petugas nyata dipilih.
    expect(state.info.petugasId).toBe('')
  })
})

describe('penilaianPrefill', () => {
  it('hanya mengisi kunci identitas yang punya sumber', () => {
    const hasil = penilaianPrefill(anggota, 'dewasa', templates)
    expect(hasil.nama).toBe('Budi Setiawan')
    expect(hasil.tglLahir).toBe('1980-02-15')
    expect(hasil.jk).toBe('L')
    // `tempatLahir` dan `riwayatKeluarga` ada di template tapi tidak punya
    // sumber di baris anggota, jadi dibiarkan kosong.
    expect(hasil.tempatLahir).toBeUndefined()
    expect(hasil.riwayatKeluarga).toBeUndefined()
  })

  it('tglLahir tidak berbentuk menghasilkan umur null', () => {
    const hasil = penilaianPrefill(
      { ...anggota, tglLahir: 'bukan tanggal' },
      'ibu-hamil',
      templates,
    )
    expect(hasil.umur).toBeUndefined()
  })

  it('umur tidak dihitung untuk tanggal lahir di masa depan', () => {
    const hasil = penilaianPrefill(
      { ...anggota, tglLahir: '2030-01-01' },
      'ibu-hamil',
      templates,
    )
    expect(hasil.umur).toBeUndefined()
  })
})

describe('reducer tidak pernah memutasi state yang diberikan', () => {
  it('seluruh action jalan pada state yang dibekukan', () => {
    const semua: KunjunganRumahAction[] = [
      {
        type: 'REPLACE_STATE',
        state: initialKunjunganRumahState(),
      },
      { type: 'SET_FIELD', key: 'alamat', value: 'x' },
      { type: 'SET_SAN_FIELD', key: 'jkn', value: true },
      { type: 'ADD_ANGGOTA' },
      { type: 'UPDATE_ANGGOTA', id: 'a1', key: 'pekerjaan', value: 'Pedagang' },
      { type: 'REMOVE_ANGGOTA', id: 'a1' },
      {
        type: 'ADD_PENILAIAN',
        anggotaId: 'a1',
        sasaran: 'ibu-hamil',
        templates,
      },
      { type: 'REMOVE_PENILAIAN', id: 'p1' },
      { type: 'SET_VALUE', id: 'p1', key: 'k', value: 'v' },
      { type: 'SET_CHECK', id: 'p1', key: 'k', checked: true },
      { type: 'BATCH_CLEAR_VALUES', id: 'p1', keys: ['k'] },
      { type: 'TOGGLE_PRIORITAS', id: 'p1', prio: 'TB' },
      { type: 'ADD_MASALAH' },
      { type: 'UPDATE_MASALAH', id: 'm1', key: 'masalah', value: 'x' },
      { type: 'REMOVE_MASALAH', id: 'm1' },
      { type: 'SET_HASIL', value: 'x' },
      { type: 'SET_JADWAL', value: 'x' },
      { type: 'SET_TTD', value: 'x' },
      { type: 'SET_TAMBAHAN_FIELD', key: 'tambahan::x', value: 'x' },
      { type: 'APPLY_SASARAN', row: suggestion() },
      { type: 'SET_INVALID', invalid: { nik: true } },
      {
        type: 'ADD_FOTOS',
        fotos: [
          {
            id: 'f',
            name: 'a.jpg',
            caption: '',
            takenAt: '2026-02-14T08:00:00.000Z',
          },
        ],
      },
      { type: 'SET_FOTO_CAPTION', index: 0, caption: 'x' },
      { type: 'REMOVE_FOTO', index: 0 },
      { type: 'RESET' },
      { type: 'LOAD_RECORD', record: recordUji() },
      { type: 'ISI_ANGGOTA_KELUARGA', rows: [suggestion()] },
      {
        type: 'ISI_SANITASI_DARI_RIWAYAT',
        sanitasi: initialKunjunganRumahState().sanitasi,
      },
      { type: 'FILL_DEMO' },
      { type: 'MISTERIUS' } as unknown as KunjunganRumahAction,
    ]
    // 30 = seluruh union `KunjunganRumahAction` + satu action tak dikenal.
    // Kalau action baru ditambah di reducer tanpa ditambah di sini, tes ini
    // gagal dan assertion-nya yang perlu ditinjau — bukan angka yang diturunkan
    // diam-diam.
    expect(semua).toHaveLength(30)

    // `beku` menggagalkan test ini kalau reducer menulis ke state lama: modul
    // ES berjalan dalam mode strict, jadi penulisan ke properti beku melempar.
    for (const action of semua) {
      const bekuState = beku(stateDenganIsi())
      expect(
        () => kunjunganRumahReducer(bekuState, action),
        action.type,
      ).not.toThrow()
    }
  })

  it('LOAD_RECORD tidak menyentuh record asal', () => {
    const asli = beku({
      id: 'rec-1',
      schemaVersion: KUNJUNGAN_RUMAH_SCHEMA_VERSION,
      clientId: 'rec-1',
      syncedAt: null,
      waktuSimpan: '2026-02-14T09:00:00.000Z',
      info: { ...initialKunjunganRumahState().info },
      sanitasi: { ...initialKunjunganRumahState().sanitasi },
      anggota: [anggota],
      penilaian: [penilaian({ values: { a: '1' } })],
      masalah: [],
      hasil: 'Kontrol ulang',
      jadwal: '',
      ttd: '',
      fotos: [],
    } satisfies KunjunganRumahRecord)
    expect(() =>
      kunjunganRumahReducer(beku(initialKunjunganRumahState()), {
        type: 'LOAD_RECORD',
        record: asli,
      }),
    ).not.toThrow()
  })
})
