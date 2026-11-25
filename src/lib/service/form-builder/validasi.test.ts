import { describe, expect, it } from 'vitest'
import {
  validasiEdisiVersi,
  validasiFieldPenuh,
  validasiNamaField,
  validasiNik,
  validasiNilaiField,
  validasiNilaiGroup,
  validasiOpsiField,
  validasiNilaiOpsiTerpilih,
  validasiSumberOpsi,
  validasiHapusForm,
  validasiHapusDraftVersi,
  validasiTerbitkanVersi,
} from './validasi'
import type { HasilValidasi } from './validasi'
import { maskNik } from './masking'
import { namaTanpaPrefix } from '@/lib/form-builder/kode-bawaan'

function kode(hasil: HasilValidasi): string | null {
  return hasil.ok ? null : hasil.kode
}

describe('validasiOpsiField', () => {
  it('tipe tanpa opsi tetap lolos walau opsi kosong', () => {
    expect(validasiOpsiField({ tipe: 'text', opsi: [] })).toEqual({ ok: true })
  })

  it('select tanpa opsi ditolak', () => {
    expect(kode(validasiOpsiField({ tipe: 'select', opsi: [] }))).toBe(
      'OPSI_KOSONG',
    )
  })

  it('opsi nonaktif tidak dihitung sebagai opsi tersedia', () => {
    const hasil = validasiOpsiField({
      tipe: 'radio',
      opsi: [{ value: 'ya', aktif: false }],
    })
    expect(kode(hasil)).toBe('OPSI_KOSONG')
  })

  it('nilai opsi dobel ditolak', () => {
    const hasil = validasiOpsiField({
      tipe: 'checkbox',
      opsi: [{ value: 'Ya' }, { value: 'Ya' }],
    })
    expect(kode(hasil)).toBe('OPSI_KOSONG')
  })

  it('opsi kosong whitespace ditolak', () => {
    const hasil = validasiOpsiField({
      tipe: 'select',
      opsi: [{ value: '   ' }],
    })
    expect(kode(hasil)).toBe('OPSI_KOSONG')
  })
})

describe('validasiEdisiVersi', () => {
  it('draft boleh diedit', () => {
    expect(validasiEdisiVersi('draft')).toEqual({ ok: true })
  })

  it('published tidak boleh diedit', () => {
    expect(kode(validasiEdisiVersi('published'))).toBe('VERSI_SUDAH_TERBIT')
  })

  it('archived tidak boleh diedit', () => {
    expect(kode(validasiEdisiVersi('archived'))).toBe('VERSI_BUKAN_DRAFT')
  })

  it('versi hilang ditolak', () => {
    expect(kode(validasiEdisiVersi(null))).toBe('VERSI_TIDAK_ADA')
  })
})

describe('validasiTerbitkanVersi', () => {
  it('draft boleh diterbitkan', () => {
    expect(validasiTerbitkanVersi('draft')).toEqual({ ok: true })
  })

  it('published tidak boleh diterbitkan dua kali', () => {
    expect(kode(validasiTerbitkanVersi('published'))).toBe('VERSI_SUDAH_TERBIT')
  })

  it('archived tidak boleh diterbitkan', () => {
    expect(kode(validasiTerbitkanVersi('archived'))).toBe('VERSI_BUKAN_DRAFT')
  })
})

describe('validasiNilaiField', () => {
  const opsi = [{ value: 'Ya' }, { value: 'Tidak' }]

  it('nilai kosong dianggap belum diisi dan lolos', () => {
    expect(validasiNilaiField({ tipe: 'text', value: null })).toEqual({
      ok: true,
    })
    expect(validasiNilaiField({ tipe: 'text', value: '' })).toEqual({
      ok: true,
    })
  })

  it('text menolak angka', () => {
    expect(kode(validasiNilaiField({ tipe: 'text', value: 42 }))).toBe(
      'NILAI_TIDAK_COCOK',
    )
  })

  it('number menolak teks', () => {
    expect(kode(validasiNilaiField({ tipe: 'number', value: '42' }))).toBe(
      'NILAI_TIDAK_COCOK',
    )
  })

  it('number menolak NaN dan Infinity', () => {
    expect(
      kode(validasiNilaiField({ tipe: 'number', value: Number.NaN })),
    ).toBe('NILAI_TIDAK_COCOK')
    expect(kode(validasiNilaiField({ tipe: 'number', value: Infinity }))).toBe(
      'NILAI_TIDAK_COCOK',
    )
  })

  it('date menolak tanggal yang tidak ada di kalender', () => {
    expect(
      kode(validasiNilaiField({ tipe: 'date', value: '2026-02-30' })),
    ).toBe('NILAI_TIDAK_COCOK')
    expect(validasiNilaiField({ tipe: 'date', value: '2026-02-28' })).toEqual({
      ok: true,
    })
  })

  it('date menolak format lain', () => {
    expect(
      kode(validasiNilaiField({ tipe: 'date', value: '28-02-2026' })),
    ).toBe('NILAI_TIDAK_COCOK')
  })

  it('time menolak jam di luar 24 jam', () => {
    expect(kode(validasiNilaiField({ tipe: 'time', value: '24:00' }))).toBe(
      'NILAI_TIDAK_COCOK',
    )
    expect(validasiNilaiField({ tipe: 'time', value: '23:59' })).toEqual({
      ok: true,
    })
  })

  it('radio menolak jawaban di luar opsi', () => {
    expect(
      kode(validasiNilaiField({ tipe: 'radio', value: 'Mungkin', opsi })),
    ).toBe('NILAI_TIDAK_COCOK')
    expect(validasiNilaiField({ tipe: 'radio', value: 'Ya', opsi })).toEqual({
      ok: true,
    })
  })

  it('checkbox menolak nilai tunggal, harus daftar', () => {
    expect(
      kode(validasiNilaiField({ tipe: 'checkbox', value: 'Ya', opsi })),
    ).toBe('NILAI_TIDAK_COCOK')
  })

  it('checkbox menerima daftar opsi', () => {
    expect(
      validasiNilaiField({ tipe: 'checkbox', value: ['Ya', 'Tidak'], opsi }),
    ).toEqual({ ok: true })
  })

  it('checkbox menolak daftar yang partly di luar opsi', () => {
    const hasil = validasiNilaiField({
      tipe: 'checkbox',
      value: ['Ya', 'Mungkin'],
      opsi,
    })
    expect(kode(hasil)).toBe('NILAI_TIDAK_COCOK')
  })

  it('opsi nonaktif tidak boleh dipilih', () => {
    const hasil = validasiNilaiField({
      tipe: 'select',
      value: 'Ya',
      opsi: [{ value: 'Ya', aktif: false }],
    })
    expect(kode(hasil)).toBe('NILAI_TIDAK_COCOK')
  })

  it('image menerima path hasil upload', () => {
    expect(
      validasiNilaiField({
        tipe: 'image',
        value: [
          { name: 'a.jpg', path: 'form/abc.jpg' },
          { name: 'b.png', path: 'form/def.png' },
        ],
      }),
    ).toEqual({ ok: true })
  })

  it('image menolak bentuk dan path yang tidak sah', () => {
    expect(validasiNilaiField({ tipe: 'image', value: 123 }).ok).toBe(false)
    expect(
      validasiNilaiField({
        tipe: 'image',
        value: [{ name: 'a.jpg', path: 'kunjungan-rumah/abc.jpg' }],
      }).ok,
    ).toBe(false)
    expect(
      validasiNilaiField({
        tipe: 'image',
        value: [{ name: 'a.jpg', dataUrl: 'data:image/jpeg;base64,AAA' }],
      }).ok,
    ).toBe(false)
    expect(
      validasiNilaiField({
        tipe: 'image',
        value: [{ name: 'a'.repeat(201), path: 'form/a.jpg' }],
      }).ok,
    ).toBe(false)
  })

  it('file masih tidak divalidasi di sini', () => {
    expect(validasiNilaiField({ tipe: 'file', value: 123 })).toEqual({
      ok: true,
    })
  })

  it('group menerima daftar baris bertipe primitif', () => {
    expect(
      validasiNilaiField({
        tipe: 'group',
        value: [
          { nik: '3273010101900001', nama: 'Siti', hadir: true },
          { nik: '3273010101900002', nama: 'Agus', hadir: false },
        ],
      }),
    ).toEqual({ ok: true })
  })

  it('group menerima daftar kosong', () => {
    expect(validasiNilaiField({ tipe: 'group', value: [] })).toEqual({
      ok: true,
    })
  })

  it('group menolak nilai tunggal, harus daftar', () => {
    expect(
      kode(validasiNilaiField({ tipe: 'group', value: { nama: 'Siti' } })),
    ).toBe('GROUP_BARIS_SISIP')
  })

  it('group menolak baris yang bukan objek', () => {
    // Nilai luarnya memang daftar, tapi tiap baris di dalamnya bukan objek.
    // Kode error-nya GROUP_NILAI_SISIP, bukan GROUP_BARIS_SISIP: yang salah
    // bentuknya isi baris, bukan nilai luarnya.
    expect(kode(validasiNilaiField({ tipe: 'group', value: ['Siti'] }))).toBe(
      'GROUP_NILAI_SISIP',
    )
    expect(kode(validasiNilaiField({ tipe: 'group', value: [null] }))).toBe(
      'GROUP_NILAI_SISIP',
    )
  })

  it('group menolak sel bersarang, karena struktur kolom tidak disimpan', () => {
    expect(
      kode(
        validasiNilaiField({
          tipe: 'group',
          value: [{ anak: { nama: 'Siti' } }],
        }),
      ),
    ).toBe('GROUP_NILAI_SISIP')
  })

  it('group menolak daftar di dalam sel', () => {
    expect(
      kode(
        validasiNilaiField({
          tipe: 'group',
          value: [{ anggota: ['Siti', 'Agus'] }],
        }),
      ),
    ).toBe('GROUP_NILAI_SISIP')
  })

  it('group menolak jumlah baris melebihi batas', () => {
    const nilai = validasiNilaiGroup({ value: [{ nama: 'Siti' }], maxBaris: 0 })
    expect(kode(nilai)).toBe('GROUP_BARIS_TERLALU_BANYAK')
  })

  it('group menolak function dan undefined di dalam sel', () => {
    const denganFunction = validasiNilaiField({
      tipe: 'group',
      value: [{ ketik: () => 'Siti' }],
    })
    expect(kode(denganFunction)).toBe('GROUP_NILAI_SISIP')

    const denganUndefined = validasiNilaiField({
      tipe: 'group',
      value: [{ nama: undefined }],
    })
    expect(kode(denganUndefined)).toBe('GROUP_NILAI_SISIP')
  })
})

describe('validasiNik', () => {
  it('16 digit lolos', () => {
    expect(validasiNik('3273010101900001')).toEqual({ ok: true })
  })

  it('huruf dan panjang salah ditolak', () => {
    expect(kode(validasiNik('327301010190000A'))).toBe('NIK_TIDAK_VALID')
    expect(kode(validasiNik('12345'))).toBe('NIK_TIDAK_VALID')
  })
})

describe('maskNik', () => {
  it('menyembunyikan digit tengah dan mempertahankan 4 digit depan/belakang', () => {
    expect(maskNik('3273010101900001')).toBe('3273****0001')
  })

  it('NIK pendek tidak bocor dan tidak error', () => {
    expect(maskNik('123')).toBe('****')
    expect(maskNik('12345678')).toBe('1234****5678')
  })

  it('hasil masking tidak mengandung NIK penuh', () => {
    const nik = '3273010101900001'
    expect(maskNik(nik)).not.toContain(nik)
    expect(maskNik(nik)).toHaveLength(12)
  })
})

describe('validasiOpsiField dengan sumber opsi dinamis', () => {
  it('field select tanpa opsi statis ditolak kalau sumbernya tidak dinamis', () => {
    expect(kode(validasiOpsiField({ tipe: 'select', opsi: [] }))).toBe(
      'OPSI_KOSONG',
    )
  })

  it('field dengan optionSourceType boleh tanpa opsi statis', () => {
    // Opsinya dibaca dari tabel `users` saat render, jadi tidak ada baris di
    // form_field_options. Menolaknya di sini akan membuat field Petugas mustahil
    // disimpan.
    expect(
      validasiOpsiField({
        tipe: 'select',
        opsi: [],
        sumberOpsiDinamis: 'users',
      }),
    ).toEqual({ ok: true })
  })

  it('sumber dinamis hanya membebaskan field yang butuh opsi', () => {
    // Field teks tidak butuh opsi sama sekali, jadi aturan ini tidak berlaku
    // untuk tipe lain meski sumbernya terisi.
    expect(
      validasiOpsiField({ tipe: 'text', opsi: [], sumberOpsiDinamis: null }),
    ).toEqual({ ok: true })
  })

  it('sumber dinamis melompati pengecekan duplikasi opsi statis', () => {
    // Batasan yang diketahui: begitu `optionSourceType` terisi, seluruh
    // pemeriksaan opsi statis dilewati, termasuk duplikasi. Untuk field dynamic
    // ini tidak menimbulkan masalah karena memang tidak ada opsi statis yang
    // dipakai — nilainya selalu dari tabel tujuan. Kalau suatu saat ada field
    // yang mencampur keduanya, aturan ini perlu diperketat.
    const hasil = validasiOpsiField({
      tipe: 'radio',
      opsi: [{ value: 'a' }, { value: 'a' }],
      sumberOpsiDinamis: 'users',
    })
    expect(hasil.ok).toBe(true)
  })
})

describe('validasiNilaiOpsiTerpilih', () => {
  const opsi = [{ value: 'a' }, { value: 'b' }, { value: 'c', aktif: false }]

  it('nilai yang ada di daftar diterima', () => {
    expect(
      validasiNilaiOpsiTerpilih({ tipe: 'select', nilai: 'a', opsi }),
    ).toEqual({ ok: true })
  })

  it('nilai yang tidak ada di daftar ditolak', () => {
    // Ini yang mencegah request yang dimanipulasi storing nilai bebas di
    // survey_entries.
    expect(
      kode(validasiNilaiOpsiTerpilih({ tipe: 'select', nilai: 'zzz', opsi })),
    ).toBe('OPSI_TIDAK_VALID')
  })

  it('opsi nonaktif tidak bisa dipilih', () => {
    expect(
      kode(validasiNilaiOpsiTerpilih({ tipe: 'select', nilai: 'c', opsi })),
    ).toBe('OPSI_TIDAK_VALID')
  })

  it('checkbox accepts some options and rejects unknown ones', () => {
    expect(
      validasiNilaiOpsiTerpilih({ tipe: 'checkbox', nilai: ['a', 'b'], opsi }),
    ).toEqual({ ok: true })
    expect(
      kode(
        validasiNilaiOpsiTerpilih({
          tipe: 'checkbox',
          nilai: ['a', 'zzz'],
          opsi,
        }),
      ),
    ).toBe('OPSI_TIDAK_VALID')
  })

  it('checkbox yang tidak dicentang (array kosong) tetap sah', () => {
    // Kalau ini ditolak, petugas tidak bisa menyimpan form tanpa memilih
    // salah satu checkbox pun.
    expect(
      validasiNilaiOpsiTerpilih({ tipe: 'checkbox', nilai: [], opsi }),
    ).toEqual({ ok: true })
  })

  it('nilai dengan spasi excess diterima karena dibandingkan setelah trim', () => {
    expect(
      validasiNilaiOpsiTerpilih({ tipe: 'select', nilai: '  a  ', opsi }),
    ).toEqual({ ok: true })
  })

  it('nilai non-string ditolak', () => {
    expect(
      kode(validasiNilaiOpsiTerpilih({ tipe: 'select', nilai: 42, opsi })),
    ).toBe('OPSI_TIDAK_VALID')
  })

  it('field tanpa opsi (teks) tidak dicek kelistanya', () => {
    expect(
      validasiNilaiOpsiTerpilih({ tipe: 'text', nilai: 'apa saja', opsi: [] }),
    ).toEqual({ ok: true })
  })
})

describe('validasiNamaField', () => {
  it('snake_case lolos', () => {
    expect(
      validasiNamaField({ nama: 'tekanan_darah', label: 'Tekanan darah' }),
    ).toEqual({ ok: true })
  })

  it('nama dengan huruf kapital ditolak', () => {
    expect(
      kode(validasiNamaField({ nama: 'TekananDarah', label: 'Tekanan darah' })),
    ).toBe('NAMA_FIELD_TIDAK_VALID')
  })

  it('nama dengan spasi, strip, dan tanda baca ditolak', () => {
    expect(kode(validasiNamaField({ nama: 'nama field', label: 'Nama' }))).toBe(
      'NAMA_FIELD_TIDAK_VALID',
    )
    expect(kode(validasiNamaField({ nama: 'nama-field', label: 'Nama' }))).toBe(
      'NAMA_FIELD_TIDAK_VALID',
    )
  })

  it('nama lebih dari 100 karakter ditolak', () => {
    expect(
      kode(validasiNamaField({ nama: 'a'.repeat(101), label: 'Nama' })),
    ).toBe('NAMA_FIELD_TIDAK_VALID')
    expect(validasiNamaField({ nama: 'a'.repeat(100), label: 'Nama' })).toEqual(
      { ok: true },
    )
  })

  it('label kosong ditolak', () => {
    expect(kode(validasiNamaField({ nama: 'nama', label: '   ' }))).toBe(
      'NAMA_FIELD_TIDAK_VALID',
    )
  })

  it('label lebih dari 255 karakter ditolak', () => {
    expect(
      kode(validasiNamaField({ nama: 'nama', label: 'a'.repeat(256) })),
    ).toBe('NAMA_FIELD_TIDAK_VALID')
    expect(validasiNamaField({ nama: 'nama', label: 'a'.repeat(255) })).toEqual(
      { ok: true },
    )
  })
})

describe('validasiFieldPenuh', () => {
  const teks = {
    nama: 'nama_warga',
    label: 'Nama warga',
    tipe: 'text' as const,
  }

  it('daftar field valid lolos', () => {
    const hasil = validasiFieldPenuh({
      fields: [
        teks,
        { nama: 'usia', label: 'Usia', tipe: 'number' },
        { nama: 'kelompok', label: 'Kelompok', tipe: 'group', jumlahKolom: 3 },
        {
          nama: 'jk',
          label: 'Jenis kelamin',
          tipe: 'radio',
          opsi: [{ value: 'L' }, { value: 'P' }],
        },
      ],
    })
    expect(hasil).toEqual({ ok: true })
  })

  it('nama dobel dalam satu payload ditolak', () => {
    const hasil = validasiFieldPenuh({
      fields: [teks, { ...teks, label: 'Nama lain' }],
    })
    expect(kode(hasil)).toBe('NAMA_FIELD_BENTARAK')
  })

  it('nama dobel yang beda spasi tetap dianggap dobel', () => {
    const hasil = validasiFieldPenuh({
      fields: [
        { ...teks, nama: 'nama_warga' },
        { ...teks, nama: ' nama_warga ' },
      ],
    })
    expect(kode(hasil)).toBe('NAMA_FIELD_BENTARAK')
  })

  it('nama tidak valid di salah satu field menolak seluruh daftar', () => {
    const hasil = validasiFieldPenuh({
      fields: [teks, { nama: 'Nama KTP', label: 'No KTP', tipe: 'text' }],
    })
    expect(kode(hasil)).toBe('NAMA_FIELD_TIDAK_VALID')
  })

  it('group tanpa jumlah kolom ditolak', () => {
    const hasil = validasiFieldPenuh({
      fields: [{ nama: 'anggota', label: 'Anggota', tipe: 'group' }],
    })
    expect(kode(hasil)).toBe('KOLOM_GROUP_KOSONG')
  })

  it('group dengan jumlah kolom nol atau negatif ditolak', () => {
    expect(
      kode(
        validasiFieldPenuh({
          fields: [
            {
              nama: 'anggota',
              label: 'Anggota',
              tipe: 'group',
              jumlahKolom: 0,
            },
          ],
        }),
      ),
    ).toBe('KOLOM_GROUP_KOSONG')
    expect(
      kode(
        validasiFieldPenuh({
          fields: [
            {
              nama: 'anggota',
              label: 'Anggota',
              tipe: 'group',
              jumlahKolom: -2,
            },
          ],
        }),
      ),
    ).toBe('KOLOM_GROUP_KOSONG')
  })

  it('tipe selain group tidak boleh punya jumlah kolom', () => {
    const hasil = validasiFieldPenuh({ fields: [{ ...teks, jumlahKolom: 2 }] })
    expect(kode(hasil)).toBe('KOLOM_GROUP_KOSONG')
  })

  it('field butuh opsi tanpa opsi ditolak', () => {
    const hasil = validasiFieldPenuh({
      fields: [{ nama: 'status', label: 'Status', tipe: 'select' }],
    })
    expect(kode(hasil)).toBe('OPSI_FIELD_KOSONG')
  })

  it('opsi nonaktif saja tetap dianggap tanpa opsi', () => {
    const hasil = validasiFieldPenuh({
      fields: [
        {
          nama: 'status',
          label: 'Status',
          tipe: 'select',
          opsi: [{ value: 'aktif', aktif: false }],
        },
      ],
    })
    expect(kode(hasil)).toBe('OPSI_FIELD_KOSONG')
  })

  it('field dengan sumber opsi dinamis boleh tanpa opsi statis', () => {
    const hasil = validasiFieldPenuh({
      fields: [
        {
          nama: 'petugas',
          label: 'Petugas',
          tipe: 'select',
          optionSourceType: 'users',
        },
      ],
    })
    expect(hasil).toEqual({ ok: true })
  })

  it('field ditandai hapus tidak ikut diperiksa', () => {
    const hasil = validasiFieldPenuh({
      fields: [
        teks,
        { nama: 'Salah Nama', label: '', tipe: 'select', hapus: true },
      ],
    })
    expect(hasil).toEqual({ ok: true })
  })

  it('pesan error menyebut posisi field yang bermasalah', () => {
    const hasil = validasiFieldPenuh({
      fields: [teks, { nama: 'status', label: 'Status', tipe: 'select' }],
    })
    expect(hasil.ok).toBe(false)
    if (!hasil.ok) expect(hasil.pesan).toContain('Field ke-2')
  })
})

describe('validasiSumberOpsi', () => {
  const tanpaOpsi: readonly { value: string }[] = []

  it('tanpa sumber selalu lolos', () => {
    expect(validasiSumberOpsi({ tipe: 'text', opsi: tanpaOpsi })).toEqual({
      ok: true,
    })
  })

  it('sumber enum pada select lolos tanpa opsi statis', () => {
    const hasil = validasiSumberOpsi({
      tipe: 'select',
      opsi: tanpaOpsi,
      optionSourceType: 'enum',
      optionSourceKey: 'agama',
    })
    expect(hasil).toEqual({ ok: true })
  })

  it('sumber tak dikenal ditolak', () => {
    const hasil = validasiSumberOpsi({
      tipe: 'select',
      opsi: tanpaOpsi,
      optionSourceType: 'entah',
      optionSourceKey: 'x',
    })
    expect(kode(hasil)).toBe('SUMBER_OPSI_TIDAK_DIKENAL')
  })

  it('key tak dikenal untuk type yang dikenal ditolak', () => {
    const hasil = validasiSumberOpsi({
      tipe: 'select',
      opsi: tanpaOpsi,
      optionSourceType: 'enum',
      optionSourceKey: 'entah',
    })
    expect(kode(hasil)).toBe('SUMBER_OPSI_TIDAK_DIKENAL')
  })

  it('prefix bucket milik Form Kunjungan Rumah ditolak', () => {
    expect(
      kode(
        validasiSumberOpsi({
          tipe: 'select',
          opsi: tanpaOpsi,
          optionSourceType: 'bucket=',
          optionSourceKey: 'bucket=kelompok-1',
        }),
      ),
    ).toBe('SUMBER_OPSI_TIDAK_DIKENAL')
    expect(
      kode(
        validasiSumberOpsi({
          tipe: 'select',
          opsi: tanpaOpsi,
          optionSourceType: 'enum',
          optionSourceKey: 'bucket=kelompok-1',
        }),
      ),
    ).toBe('SUMBER_OPSI_TIDAK_DIKENAL')
  })

  it('sumber tidak boleh dipakai di field yang tidak butuh pilihan', () => {
    const hasil = validasiSumberOpsi({
      tipe: 'number',
      opsi: tanpaOpsi,
      optionSourceType: 'enum',
      optionSourceKey: 'agama',
    })
    expect(kode(hasil)).toBe('SUMBER_OPSI_TIPE_SALAH')
  })

  it('daftar saran hanya untuk field teks', () => {
    expect(
      kode(
        validasiSumberOpsi({
          tipe: 'select',
          opsi: tanpaOpsi,
          optionSourceType: 'suggest',
        }),
      ),
    ).toBe('SUMBER_OPSI_TIPE_SALAH')
    expect(
      validasiSumberOpsi({
        tipe: 'text',
        opsi: [{ value: 'Budi' }],
        optionSourceType: 'suggest',
      }),
    ).toEqual({ ok: true })
  })

  it('sumber dan opsi manual sekaligus ditolak', () => {
    const hasil = validasiSumberOpsi({
      tipe: 'select',
      opsi: [{ value: 'Islam' }],
      optionSourceType: 'enum',
      optionSourceKey: 'agama',
    })
    expect(kode(hasil)).toBe('SUMBER_OPSI_TIDAK_DIKENAL')
  })

  it('opsi manual kosong (value kosong) tidak dianggap konflik', () => {
    expect(
      validasiSumberOpsi({
        tipe: 'select',
        opsi: [{ value: '  ' }],
        optionSourceType: 'enum',
        optionSourceKey: 'agama',
      }),
    ).toEqual({ ok: true })
  })

  it('ditolak lewat validasiFieldPenuh dengan posisi field', () => {
    const hasil = validasiFieldPenuh({
      fields: [
        { nama: 'umur', label: 'Umur', tipe: 'number' },
        {
          nama: 'agama',
          label: 'Agama',
          tipe: 'select',
          optionSourceType: 'entah',
          optionSourceKey: 'x',
        },
      ],
    })
    expect(kode(hasil)).toBe('SUMBER_OPSI_TIDAK_DIKENAL')
    if (!hasil.ok) expect(hasil.pesan).toContain('Field ke-2')
  })
})

describe('validasiHapusForm', () => {
  const base = {
    nama: 'Form Uji Coba',
    kode: null,
    ringkasan: {
      jumlahVersi: 3,
      jumlahSubmit: 0,
      jumlahJawaban: 0,
      jumlahWarga: 0,
      tanggalTerakhir: null,
    },
  }

  it('form tanpa isian boleh dihapus biasa walau versinya banyak', () => {
    expect(validasiHapusForm(base)).toEqual({ ok: true })
  })

  it('form bawaan sistem tidak boleh dihapus, walau tanpa isian', () => {
    const hasil = validasiHapusForm({
      ...base,
      kode: 'CHECKLIST_KUNJUNGAN_RUMAH',
    })
    expect(kode(hasil)).toBe('FORM_BAWAAN')
  })

  it('form berisian ditolak tanpa hapusPermanent', () => {
    const hasil = validasiHapusForm({
      ...base,
      ringkasan: {
        ...base.ringkasan,
        jumlahSubmit: 12,
        jumlahJawaban: 96,
        jumlahWarga: 12,
      },
    })
    expect(kode(hasil)).toBe('FORM_PUNYA_ISIAN')
    if (!hasil.ok) {
      expect(hasil.pesan).toContain('12 isian')
      expect(hasil.pesan).toContain('96 jawaban')
    }
  })

  it('hapus permanen tanpa konfirmasi nama ditolak', () => {
    const hasil = validasiHapusForm({
      ...base,
      ringkasan: { ...base.ringkasan, jumlahSubmit: 1 },
      hapusPermanent: true,
    })
    expect(kode(hasil)).toBe('KONFIRMASI_NAMA_SALAH')
  })

  it('nama konfirmasi harus sama persis', () => {
    const params = {
      ...base,
      ringkasan: { ...base.ringkasan, jumlahSubmit: 1 },
      hapusPermanent: true,
    }
    expect(
      kode(validasiHapusForm({ ...params, konfirmasiNama: 'form uji coba' })),
    ).toBe('KONFIRMASI_NAMA_SALAH')
    expect(
      validasiHapusForm({ ...params, konfirmasiNama: '  Form Uji Coba  ' }),
    ).toEqual({ ok: true })
  })

  it('konfirmasi nama tidak diminta kalau form tidak punya isian', () => {
    expect(
      validasiHapusForm({
        ...base,
        hapusPermanent: true,
        konfirmasiNama: null,
      }),
    ).toEqual({ ok: true })
  })

  it('kunci konfirmasi hanya diminta kalau memang ada isian', () => {
    const hasil = validasiHapusForm({
      ...base,
      ringkasan: { ...base.ringkasan, jumlahSubmit: 1 },
      hapusPermanent: true,
      konfirmasiNama: 'Form Uji Coba',
    })
    expect(hasil).toEqual({ ok: true })
  })
})

// Dua parameter ini hanya dipakai untuk form bawaan, yang definisinya sudah ada
// di database sebelum Form Builder bisa menyuntingnya. Keduanya opsional, jadi
// form manual tidak ikut berubah perilakunya.
describe('validasiFieldPenuh dengan normalisasiNama', () => {
  // Pakai helper asli, bukan tiruan: nama yang divalidasi di produksi memang
  // fungsi ini, jadi menyalin logikanya ke sini pasti bisa menyimpang.
  const bukaPrefix = (nama: string) => namaTanpaPrefix(nama)

  it('nama ber-prefix :: ditolak secara default', () => {
    // Pola nama field hanya menerima huruf kecil, angka, dan garis bawah.
    const hasil = validasiFieldPenuh({
      fields: [{ nama: 'keluargaInfo::nik', label: 'NIK', tipe: 'text' }],
    })
    expect(kode(hasil)).toBe('NAMA_FIELD_TIDAK_VALID')
  })

  it('nama ber-prefix :: diterima setelah prefix dibuka', () => {
    const hasil = validasiFieldPenuh({
      normalisasiNama: bukaPrefix,
      fields: [{ nama: 'keluargaInfo::nik', label: 'NIK', tipe: 'text' }],
    })
    expect(hasil).toEqual({ ok: true })
  })

  it('nama yang sama dalam dua bentuk berbeda tetap dianggap dobel', () => {
    // `nik` dan `keluargaInfo::nik` menunjuk field yang sama, jadi tidak boleh
    // lolos sebagai dua field terpisah.
    const hasil = validasiFieldPenuh({
      normalisasiNama: bukaPrefix,
      fields: [
        { nama: 'keluargaInfo::nik', label: 'NIK', tipe: 'text' },
        { nama: 'nik', label: 'NIK lagi', tipe: 'text' },
      ],
    })
    expect(kode(hasil)).toBe('NAMA_FIELD_BENTARAK')
  })

  it('id yang sama di dua section lolos karena diperiksa per section', () => {
    // Justru inilah alasan prefix ada: template memakai ulang id antar section.
    // `validateAllFields` memanggil `validasiFieldPenuh` satu kali per section,
    // jadi dua section dengan id sama tidak pernah dibandingkan. Dipanggil
    // sekaligus di sini, keduanya akan dianggap dobel — itu memang benar,
    // karena dalam satu section nama ganda tidak bisa dibedakan.
    const keluarga = validasiFieldPenuh({
      normalisasiNama: bukaPrefix,
      fields: [{ nama: 'keluargaInfo::nik', label: 'NIK', tipe: 'text' }],
    })
    const anggota = validasiFieldPenuh({
      normalisasiNama: bukaPrefix,
      fields: [{ nama: 'anggota::nik', label: 'NIK', tipe: 'text' }],
    })
    expect(keluarga).toEqual({ ok: true })
    expect(anggota).toEqual({ ok: true })
  })

  it('dua nama berbeda di section yang sama tetap ditolak setelah prefix dibuka', () => {
    const hasil = validasiFieldPenuh({
      normalisasiNama: bukaPrefix,
      fields: [
        { nama: 'keluargaInfo::nik', label: 'NIK', tipe: 'text' },
        { nama: 'keluargaInfo::nik', label: 'NIK dua', tipe: 'text' },
      ],
    })
    expect(kode(hasil)).toBe('NAMA_FIELD_BENTARAK')
  })
})

describe('validasiFieldPenuh dengan fieldBawaan', () => {
  const bawaan = (nama: string, tipe: string, label = 'Label') => ({
    nama,
    label,
    tipe: tipe as 'text',
    fieldBawaan: true,
  })

  it('field bawaan boleh punya nama yang tidak lolos pola nama', () => {
    // Nama bawaan form kunjungan rumah mengandung huruf besar dan sudah dipakai
    // data yang tersimpan, jadi tidak boleh ditolak hanya karena bentuknya.
    const hasil = validasiFieldPenuh({
      fields: [bawaan('tglPengumpulan', 'date')],
    })
    expect(hasil).toEqual({ ok: true })
  })

  it('field bawaan boleh tanpa opsi walau tipenya butuh opsi', () => {
    const hasil = validasiFieldPenuh({ fields: [bawaan('jkn', 'checkbox')] })
    expect(hasil).toEqual({ ok: true })
  })

  it('field bawaan boleh tanpa jumlah kolom walau tipenya group', () => {
    const hasil = validasiFieldPenuh({
      fields: [bawaan('record_legacy', 'group')],
    })
    expect(hasil).toEqual({ ok: true })
  })

  it('field bawaan tetap wajib punya teks pertanyaan', () => {
    const hasil = validasiFieldPenuh({ fields: [bawaan('nik', 'text', '   ')] })
    expect(kode(hasil)).toBe('NAMA_FIELD_TIDAK_VALID')
  })

  it('field bawaan tetap wajib punya nama unik di sectionnya', () => {
    const hasil = validasiFieldPenuh({
      fields: [bawaan('nik', 'text'), bawaan('nik', 'text', 'NIK kedua')],
    })
    expect(kode(hasil)).toBe('NAMA_FIELD_BENTARAK')
  })

  it('field baru tetap diperiksa penuh walau ada field bawaan di sebelahnya', () => {
    // `fieldBawaan` hanya berlaku pada field itu sendiri. Field baru di sebelahnya
    // tetap harus lolos pola nama.
    const hasilKedua = validasiFieldPenuh({
      fields: [
        bawaan('tglPengumpulan', 'date'),
        { nama: 'bukanPola', label: 'Nama', tipe: 'text' },
      ],
    })
    expect(kode(hasilKedua)).toBe('NAMA_FIELD_TIDAK_VALID')

    // Catatan: `textarea` lolos di sini karena validator ini tidak tahu soal lima
    // tipe yang bisa dirender form kader. Itu urusan `kode-bawaan.ts`, dan sudah
    // diuji lewat cross-check di `kode-bawaan.test.ts`.
    const hasil = validasiFieldPenuh({
      fields: [
        bawaan('tglPengumpulan', 'date'),
        { nama: 'catatan', label: 'Catatan', tipe: 'textarea' },
      ],
    })
    expect(hasil).toEqual({ ok: true })
  })
})

describe('validasiHapusDraftVersi', () => {
  function dasar(
    ubah: Partial<Parameters<typeof validasiHapusDraftVersi>[0]> = {},
  ) {
    return validasiHapusDraftVersi({
      status: 'draft',
      kodeForm: null,
      jumlahVersi: 2,
      ringkasan: { jumlahSubmit: 0, jumlahField: 5, jumlahSection: 2 },
      ...ubah,
    })
  }

  it('draft form manual dengan lebih dari satu versi boleh dihapus', () => {
    expect(dasar()).toEqual({ ok: true })
  })

  it('versi published tidak boleh dihapus', () => {
    expect(kode(dasar({ status: 'published' }))).toBe('VERSI_BUKAN_DRAFT')
  })

  it('versi archived juga ditolak, bukan dianggap draft', () => {
    expect(kode(dasar({ status: 'archived' }))).toBe('VERSI_BUKAN_DRAFT')
  })

  it('versi yang tidak ada ditolak lebih dulu sebelum cek lain', () => {
    // Draft bawaan dan versi tunggalnya sama-sama tidak sah, tapi versi yang
    // hilang harus disebut lebih dulu supaya pesan tidak menyesatkan.
    expect(kode(dasar({ status: null, kodeForm: 'kunjungan_rumah' }))).toBe(
      'VERSI_TIDAK_ADA',
    )
  })

  it('draft form bawaan sistem tidak boleh dihapus', () => {
    const hasil = dasar({ kodeForm: 'kunjungan_rumah' })
    expect(kode(hasil)).toBe('DRAFT_BAWAAN_TERKUNCI')
    expect(hasil.ok).toBe(false)
    if (!hasil.ok) expect(hasil.pesan).toMatch(/bawaan/i)
  })

  it('draft yang sudah punya isian tidak boleh dihapus', () => {
    const hasil = dasar({
      ringkasan: { jumlahSubmit: 3, jumlahField: 5, jumlahSection: 2 },
    })
    expect(kode(hasil)).toBe('FORM_PUNYA_ISIAN')
    if (!hasil.ok) expect(hasil.pesan).toContain('3 isian')
  })

  it('versi satu-satunya tidak boleh dihapus walau formnya manual', () => {
    const hasil = dasar({ jumlahVersi: 1 })
    expect(kode(hasil)).toBe('VERSI_HANYA_SATU')
    if (!hasil.ok) expect(hasil.pesan).toMatch(/satu-satunya/i)
  })

  it('cek status berjalan sebelum cek bawaan', () => {
    // published pada form bawaan harus ditolak sebagai versi yang salah status,
    // bukan sebagai draft bawaan yang terkunci.
    expect(
      kode(dasar({ status: 'published', kodeForm: 'kunjungan_rumah' })),
    ).toBe('VERSI_BUKAN_DRAFT')
  })

  it('draft kosong pada form dengan banyak versi tetap boleh dihapus', () => {
    // Draft kosong bukan alasan menolak: justru itu yang paling sering ingin
    // dibuang admin setelah salah klik "Draft Berikutnya".
    expect(
      dasar({
        jumlahVersi: 4,
        ringkasan: { jumlahSubmit: 0, jumlahField: 0, jumlahSection: 0 },
      }),
    ).toEqual({ ok: true })
  })
})
