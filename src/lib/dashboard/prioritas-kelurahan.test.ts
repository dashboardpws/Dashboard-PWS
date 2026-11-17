import { describe, expect, it } from 'vitest'
import type { BarisPrioritas } from '@/lib/prioritas/prioritas'
import { hitungPrioritasKelurahan } from './prioritas-kelurahan'
import type { KunjunganPrioritas, WargaKelurahan } from './prioritas-kelurahan'

const NIK = {
  a: '1111111111111111',
  b: '2222222222222222',
  c: '3333333333333333',
  d: '4444444444444444',
  e: '5555555555555555',
  f: '6666666666666666',
  g: '7777777777777777',
  h: '8888888888888888',
}

const master: BarisPrioritas[] = [
  { id: 1, kode: 'TB', nama: 'TB', urutan: 1, aktif: true },
  {
    id: 2,
    kode: 'Bumil Risti',
    nama: 'Ibu Hamil Risiko Tinggi',
    urutan: 2,
    aktif: true,
  },
  {
    id: 3,
    kode: 'Balita Risti',
    nama: 'Balita Risiko Tinggi',
    urutan: 3,
    aktif: true,
  },
]

function warga(
  nik: string,
  nama: string,
  kelurahan = 'Mayangan',
): WargaKelurahan {
  return { nik, nama, kelurahan, ref: `ref-${nama}` }
}

/** Kunjungan dengan satu anggota dan satu penilaian untuk anggota itu. */
function kunjungan(
  nik: string,
  tanggal: string,
  prioritas: string[],
  waktuSimpan = `${tanggal}T08:00:00.000Z`,
): KunjunganPrioritas {
  return {
    nik,
    tanggal,
    waktuSimpan,
    anggota: [{ id: 'a1', nik, nama: `Warga ${nik}` }],
    penilaian: [{ anggotaId: 'a1', prioritas }],
  }
}

function hitung(
  wargaList: WargaKelurahan[],
  kunjunganList: KunjunganPrioritas[],
  dikunjungi: string[],
) {
  return hitungPrioritasKelurahan({
    warga: wargaList,
    dikunjungi,
    kunjungan: kunjunganList,
    daftarPrioritas: master,
  })
}

describe('hitungPrioritasKelurahan', () => {
  it('menghitung persen dari total warga kelurahan', () => {
    const hasil = hitung(
      [warga(NIK.a, 'A'), warga(NIK.b, 'B'), warga(NIK.c, 'C')],
      [kunjungan(NIK.a, '2026-02-01', ['TB'])],
      [NIK.a],
    )
    const tb = hasil[0]!.prioritas.find((row) => row.kode === 'TB')
    expect(tb?.jumlah).toBe(1)
    expect(tb?.pct).toBe(33)
    expect(hasil[0]!.total).toBe(3)
    expect(hasil[0]!.dikunjungi).toBe(1)
    expect(hasil[0]!.belumDikunjungi).toBe(2)
  })

  it('prioritas dari kunjungan terbaru menimpa kunjungan lama', () => {
    const hasil = hitung(
      [warga(NIK.a, 'A')],
      [
        kunjungan(NIK.a, '2026-01-01', ['TB']),
        kunjungan(NIK.a, '2026-02-01', ['Bumil Risti']),
      ],
      [NIK.a],
    )
    const tb = hasil[0]!.prioritas.find((row) => row.kode === 'TB')
    const bumil = hasil[0]!.prioritas.find((row) => row.kode === 'Bumil Risti')
    expect(tb?.jumlah).toBe(0)
    expect(bumil?.jumlah).toBe(1)
    expect(hasil[0]!.denganPrioritas).toBe(1)
  })

  it('kunjungan terbaru tanpa prioritas menghapus prioritas lama', () => {
    const hasil = hitung(
      [warga(NIK.a, 'A')],
      [
        kunjungan(NIK.a, '2026-01-01', ['TB']),
        kunjungan(NIK.a, '2026-02-01', []),
      ],
      [NIK.a],
    )
    expect(hasil[0]!.prioritas.find((row) => row.kode === 'TB')?.jumlah).toBe(0)
    expect(hasil[0]!.tanpaPrioritas).toBe(1)
    expect(hasil[0]!.denganPrioritas).toBe(0)
  })

  it('satu warga dengan beberapa prioritas dihitung di setiap baris', () => {
    const hasil = hitung(
      [warga(NIK.a, 'A'), warga(NIK.b, 'B')],
      [kunjungan(NIK.a, '2026-02-01', ['TB', 'Balita Risti'])],
      [NIK.a],
    )
    expect(hasil[0]!.denganPrioritas).toBe(1)
    expect(hasil[0]!.prioritas.find((row) => row.kode === 'TB')?.jumlah).toBe(1)
    expect(
      hasil[0]!.prioritas.find((row) => row.kode === 'Balita Risti')?.jumlah,
    ).toBe(1)
  })

  it('warga yang sudah dikunjungi tanpa prioritas masuk tanpaPrioritas', () => {
    const hasil = hitung(
      [warga(NIK.a, 'A'), warga(NIK.b, 'B')],
      [kunjungan(NIK.a, '2026-02-01', [])],
      [NIK.a, NIK.b],
    )
    expect(hasil[0]!.dikunjungi).toBe(2)
    expect(hasil[0]!.tanpaPrioritas).toBe(2)
    expect(hasil[0]!.belumDikunjungi).toBe(0)
  })

  it('warga belum dikunjungi tidak dihitung punya prioritas', () => {
    const hasil = hitung(
      [warga(NIK.a, 'A'), warga(NIK.b, 'B')],
      [kunjungan(NIK.a, '2026-02-01', ['TB'])],
      [NIK.a],
    )
    expect(hasil[0]!.belumDikunjungi).toBe(1)
    expect(hasil[0]!.denganPrioritas).toBe(1)
    expect(hasil[0]!.tanpaPrioritas).toBe(0)
  })

  it('NIK di luar master warga diabaikan', () => {
    const hasil = hitung(
      [warga(NIK.a, 'A')],
      [kunjungan(NIK.b, '2026-02-01', ['TB'])],
      [NIK.b],
    )
    expect(hasil[0]!.total).toBe(1)
    expect(hasil[0]!.dikunjungi).toBe(0)
    expect(hasil[0]!.prioritas.find((row) => row.kode === 'TB')?.jumlah).toBe(0)
  })

  it('kode prioritas tak dikenal tetap tampil dengan kodenya', () => {
    const hasil = hitung(
      [warga(NIK.a, 'A')],
      [kunjungan(NIK.a, '2026-02-01', ['Hipertensi'])],
      [NIK.a],
    )
    const row = hasil[0]!.prioritas.find((item) => item.kode === 'Hipertensi')
    expect(row?.nama).toBe('Hipertensi')
    expect(row?.jumlah).toBe(1)
  })

  it('prioritas nonaktif tanpa warga disembunyikan, prioritas aktif tetap tampil', () => {
    const daftar = [
      ...master,
      { id: 4, kode: 'Lama', nama: 'Prioritas Lama', urutan: 4, aktif: false },
    ]
    const hasil = hitungPrioritasKelurahan({
      warga: [warga(NIK.a, 'A')],
      dikunjungi: [],
      kunjungan: [],
      daftarPrioritas: daftar,
    })
    const kode = hasil[0]!.prioritas.map((row) => row.kode)
    expect(kode).toContain('TB')
    expect(kode).not.toContain('Lama')
    expect(hasil[0]!.prioritas.every((row) => row.jumlah === 0)).toBe(true)
  })

  it('daftar warga dibatasi dan sisanya dilaporkan sebagai wargaLainnya', () => {
    const wargaList = Object.values(NIK)
      .slice(0, 7)
      .map((nik, i) => warga(nik, `Warga ${i}`))
    const kunjunganList = wargaList.map((w) =>
      kunjungan(w.nik, '2026-02-01', ['TB']),
    )
    const hasil = hitung(
      wargaList,
      kunjunganList,
      wargaList.map((w) => w.nik),
    )
    const tb = hasil[0]!.prioritas.find((row) => row.kode === 'TB')
    expect(tb?.jumlah).toBe(7)
    expect(tb?.warga).toHaveLength(5)
    expect(tb?.wargaLainnya).toBe(2)
  })

  it('membaca bentuk lama penilaianByNik', () => {
    const hasil = hitung(
      [warga(NIK.a, 'A')],
      [
        {
          nik: NIK.a,
          tanggal: '2026-02-01',
          waktuSimpan: '2026-02-01T08:00:00.000Z',
          penilaianByNik: {
            [NIK.a]: [{ anggotaId: 'x', prioritas: ['TB'] }],
          },
        },
      ],
      [NIK.a],
    )
    expect(hasil[0]!.prioritas.find((row) => row.kode === 'TB')?.jumlah).toBe(1)
  })

  it('atribusi ke NIK kepala keluarga hanya untuk keluarga satu anggota', () => {
    const satuAnggota: KunjunganPrioritas = {
      nik: NIK.a,
      tanggal: '2026-02-01',
      waktuSimpan: '2026-02-01T08:00:00.000Z',
      anggota: [{ id: 'lain', nik: NIK.b, nama: 'B' }],
      penilaian: [{ anggotaId: 'tidak-ada', prioritas: ['TB'] }],
    }
    const hasil = hitung(
      [warga(NIK.a, 'A'), warga(NIK.b, 'B')],
      [satuAnggota],
      [NIK.a, NIK.b],
    )
    // Anggota yang tercatat bukan kepala keluarga, jadi tidak ditebak.
    expect(hasil[0]!.prioritas.find((row) => row.kode === 'TB')?.jumlah).toBe(0)

    const tanpaId: KunjunganPrioritas = {
      nik: NIK.a,
      tanggal: '2026-02-01',
      waktuSimpan: '2026-02-01T08:00:00.000Z',
      penilaian: [{ prioritas: ['TB'] }],
    }
    const kedua = hitung(
      [warga(NIK.a, 'A'), warga(NIK.b, 'B')],
      [tanpaId],
      [NIK.a, NIK.b],
    )
    expect(kedua[0]!.prioritas.find((row) => row.kode === 'TB')?.jumlah).toBe(1)
  })

  it('tanpa warga menghasilkan daftar kosong', () => {
    expect(hitung([], [], [])).toEqual([])
  })

  it('mengelompokkan per kelurahan', () => {
    const hasil = hitung(
      [warga(NIK.a, 'A', 'Mayangan'), warga(NIK.b, 'B', 'Tambaan')],
      [
        kunjungan(NIK.a, '2026-02-01', ['TB']),
        kunjungan(NIK.b, '2026-02-01', ['TB']),
      ],
      [NIK.a, NIK.b],
    )
    expect(hasil).toHaveLength(2)
    expect(hasil.map((item) => item.kelurahan)).toEqual(['Mayangan', 'Tambaan'])
    expect(hasil[0]!.belumDikunjungi).toBe(0)
  })
})
