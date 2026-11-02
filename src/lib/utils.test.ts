/**
 * Uji utilitas bersama (`src/lib/utils.ts`).
 *
 * Fokusnya dua hal. Pertama, fungsi normalisasi NIK/PIN dan pembacaan pesan
 * error — inti validasi yang dipakai di banyak tempat, jadi harus punya
 * perilaku yang terkunci. Kedua, integritas variant pill: setiap `var(--...)`
 * yang dirujuk harus benar-benar ada di `src/styles.css`.
 *
 * Pengecekan token warna itu penting justru karena salahnya tidak terlihat di
 * review: nama variabel CSS yang salah ketik tidak melempar error, pill hanya
 * tampil tanpa warna dan layoutgeser diam-diam.
 *
 * Yang TIDAK diuji di sini: `triggerDownload` dan `downloadCsv`. Keduanya
 * menyentuh `document`, `URL`, dan `window.setTimeout`, jadi butuh DOM. Vitest
 * di repo ini masih `environment: node` dan hanya meng-include `*.test.ts`;
 * pemindahannya ke jsdom sudah direncanakan bersama pengujian komponen.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  cn,
  escapeCsvCell,
  fmtDate,
  hariIni,
  isValidNik,
  normalkanNik,
  normalkanPin,
  PILL_STYLES,
  priorityTagVariant,
  statusVariantFrom,
  todayISO,
  pesanError,
  buttonClass,
  pctOf,
} from '@/lib/utils'

describe('cn', () => {
  it('menggabung kelas dan membuang yang kosong', () => {
    expect(cn('a', 'b')).toBe('a b')
    expect(cn('a', false, null, undefined, '', 'b')).toBe('a b')
    expect(cn()).toBe('')
  })
})

describe('buttonClass', () => {
  it('menggabung varian dan ukuran untuk semua kombinasi Button', () => {
    // ButtonLink merakit kelas yang sama tanpa lewat komponen `Button`, jadi
    // penguncian di sini menjaga keduanya tetap identik.
    expect(buttonClass('primary', 'md')).toBe(
      'border-accent bg-accent text-ink-2 hover:bg-accent-hover min-h-10 px-5 py-2.5 text-sm',
    )
    expect(buttonClass('danger', 'sm')).toBe(
      'border-[var(--color-danger-border)] bg-surface text-danger hover:bg-[var(--color-danger-soft)] min-h-8 px-3 py-1 text-xs',
    )
    expect(buttonClass()).toBe(buttonClass('default', 'md'))
  })
})

describe('pctOf', () => {
  it('membulatkan ke persen terdekat', () => {
    expect(pctOf(1, 3)).toBe(33)
    expect(pctOf(2, 3)).toBe(67)
    expect(pctOf(50, 100)).toBe(50)
  })

  it('total 0 atau negatif menghasilkan 0, bukan NaN atau Infinity', () => {
    // Kartu statistik menampilkan `pct(bagian, total)` langsung; NaN akan
    // tampil mentah di layar sebelum di sanitasi.
    expect(pctOf(5, 0)).toBe(0)
    expect(pctOf(5, -10)).toBe(0)
  })
})

describe('normalkanNik dan normalkanPin', () => {
  it('membuang semua non-digit', () => {
    expect(normalkanNik('3579 0152 0280 0001')).toBe('3579015202800001')
    expect(normalkanPin('12-34.56')).toBe('123456')
  })

  it('memotong paling banyak 16 digit', () => {
    expect(normalkanNik('357901520280000123456')).toBe('3579015202800001')
    expect(normalkanPin('12345678901234567890')).toBe('1234567890123456')
  })

  it('memangkas lebih dulu sebelum menghitung panjang', () => {
    // Garis dan spasi tidak menambah panjang hasil, jadi NIK 16 digit dengan
    // pemisah harus tetap sah.
    expect(isValidNik(normalkanNik('3579-0152-0280-0001'))).toBe(true)
  })

  it('memangkas huruf semua, jadi input non-angka jadi kosong', () => {
    // `String(undefined)` = "undefined"; semua karakternya bukan digit, jadi
    // hasilnya kosong, bukan lempar error. Form menampilkan kolom kosong.
    expect(normalkanNik(String(undefined))).toBe('')
    expect(normalkanPin(String(null))).toBe('')
    expect(normalkanNik('abc')).toBe('')
  })

  it('dua fungsi sengaja terpisah meski isinya sama', () => {
    // PIN bukan NIK. Keduanya sama-sama deretan digit hanya karena kebetulan.
    expect(normalkanPin('12ab34')).toBe(normalkanNik('12ab34'))
  })
})

describe('isValidNik', () => {
  it('hanya menerima tepat 16 digit', () => {
    expect(isValidNik('3579015202800001')).toBe(true)
    expect(isValidNik('357901520280000')).toBe(false)
    expect(isValidNik('35790152028000012')).toBe(false)
    expect(isValidNik('')).toBe(false)
    expect(isValidNik('3579-0152-0280-0001')).toBe(false)
  })
})

describe('pesanError', () => {
  it('memprioritaskan properti pesan di atas message', () => {
    // Server melempar objek dengan field `pesan`, bukan `message`. Kalau `message`
    // dibaca lebih dulu, pesan Error bawaan ("non-ok response") yang tampil.
    const err = Object.assign(new Error('dari message'), {
      pesan: 'NIK sudah terdaftar',
    })
    expect(pesanError(err, 'cadangan')).toBe('NIK sudah terdaftar')
  })

  it('memakai message ketika tidak ada properti pesan', () => {
    expect(pesanError(new Error('gagal menyimpan'), 'cadangan')).toBe(
      'gagal menyimpan',
    )
  })

  it('memakai cadangan untuk nilai yang tidak paham', () => {
    expect(pesanError(undefined, 'cadangan')).toBe('cadangan')
    expect(pesanError(null, 'cadangan')).toBe('cadangan')
    expect(pesanError('string biasa', 'cadangan')).toBe('cadangan')
    expect(pesanError({}, 'cadangan')).toBe('cadangan')
  })

  it('memakai cadangan saat pesan kosong atau hanya spasi', () => {
    expect(pesanError({ pesan: '' }, 'cadangan')).toBe('cadangan')
    expect(pesanError({ pesan: '   ' }, 'cadangan')).toBe('cadangan')
    expect(pesanError({ pesan: 42 }, 'cadangan')).toBe('cadangan')
  })
})

describe('fmtDate', () => {
  it('mengubah YYYY-MM-DD menjadi DD/MM/YYYY', () => {
    expect(fmtDate('2026-02-14')).toBe('14/02/2026')
  })

  it('mengembalikan input apa adanya kalau bukan tiga bagian', () => {
    expect(fmtDate('bukan tanggal')).toBe('bukan tanggal')
    expect(fmtDate('')).toBe('')
    expect(fmtDate('2026-02')).toBe('2026-02')
  })
})

describe('hariIni', () => {
  it('menghasilkan format YYYY-MM-DD', () => {
    expect(hariIni()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('todayISO adalah alias dari fungsi yang sama', () => {
    expect(todayISO).toBe(hariIni)
  })
})

describe('priorityTagVariant', () => {
  it('memetakan prioritas yang dikenal', () => {
    expect(priorityTagVariant('ODGJ')).toBe('odgj')
    expect(priorityTagVariant('Bumil Risti')).toBe('bumil')
    expect(priorityTagVariant('Balita Risti')).toBe('balita')
    expect(priorityTagVariant('TB')).toBe('tb')
    expect(priorityTagVariant('Stunting')).toBe('stunt')
  })

  it('jatuh ke odgj untuk nilai tak dikenal atau kosong', () => {
    // Prioritas baru yang belum dipetakan harus tetap tampil sebagai chip
    // generik, bukan membuat komponen gagal render.
    expect(priorityTagVariant('Sesuatu')).toBe('odgj')
    expect(priorityTagVariant('')).toBe('odgj')
    expect(priorityTagVariant(null)).toBe('odgj')
    expect(priorityTagVariant(undefined)).toBe('odgj')
  })
})

describe('statusVariantFrom', () => {
  it('memetakan seluruh label status yang dipakai UI', () => {
    expect(statusVariantFrom('Sudah')).toBe('done')
    expect(statusVariantFrom('Selesai')).toBe('done')
    expect(statusVariantFrom('Aktif')).toBe('done')
    expect(statusVariantFrom('Belum')).toBe('belum')
    expect(statusVariantFrom('Perlu tindak lanjut')).toBe('process')
    expect(statusVariantFrom('Terjadwal')).toBe('jadwal')
    expect(statusVariantFrom('Hadir')).toBe('hadir')
    expect(statusVariantFrom('Izin')).toBe('izin')
    expect(statusVariantFrom('Nonaktif')).toBe('off')
  })

  it('jatuh ke pending untuk nilai tak dikenal atau kosong', () => {
    expect(statusVariantFrom('Apa saja')).toBe('pending')
    expect(statusVariantFrom('')).toBe('pending')
    expect(statusVariantFrom(null)).toBe('pending')
    expect(statusVariantFrom(undefined)).toBe('pending')
  })

  it('sensitive terhadap huruf besar-kecil', () => {
    // Sengaja tidak dinormalkan: pemanggil boleh menyimpan label apa adanya,
    // jadi casing yang tak cocok akan tampil sebagai pending.
    expect(statusVariantFrom('sudah')).toBe('pending')
  })
})

describe('PILL_STYLES', () => {
  const stylesCss = readFileSync(
    fileURLToPath(new URL('../styles.css', import.meta.url)),
    'utf8',
  )

  it('tidak ada hex atau rgb literal ad-hoc', () => {
    // Warna harus lewat token `@theme`. Nilai hex di sini berarti ada gaya yang
    // tidak ikut berubah saat tema gelap/terang diganti.
    for (const [variant, kelas] of Object.entries(PILL_STYLES)) {
      expect(kelas, `variant ${variant} memakai literal warna`).not.toMatch(
        /#[0-9a-fA-F]{3,8}\b/,
      )
      expect(kelas, `variant ${variant} memakai rgb()`).not.toMatch(/\brgba?\(/)
    }
  })

  it('setiap token warna yang dirujuk benar-benar ada di styles.css', () => {
    // Nama variabel CSS yang salah ketik tidak melempar error apa pun: pill
    // hanya tampil tanpa warna. Test ini yang menangkapnya.
    const deklarasi = new Set(
      [...stylesCss.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gim)].map(
        (m) => m[1] ?? '',
      ),
    )
    const dirujuk = new Set(
      Object.values(PILL_STYLES).flatMap((kelas) => [
        ...[...kelas.matchAll(/var\((--[a-z0-9-]+)\)/g)].map((m) => m[1] ?? ''),
      ]),
    )

    expect(dirujuk.size).toBeGreaterThan(0)
    const hilang = [...dirujuk].filter((token) => !deklarasi.has(token))
    expect(
      hilang,
      `token warna belum dideklarasikan di styles.css: ${hilang.join(', ')}`,
    ).toEqual([])
  })

  it('setiap variant punya gaya border, latar, dan teks', () => {
    for (const [variant, kelas] of Object.entries(PILL_STYLES)) {
      expect(kelas, `variant ${variant} tanpa border`).toMatch(/border-\[/)
      expect(kelas, `variant ${variant} tanpa latar`).toMatch(/bg-\[/)
      expect(kelas, `variant ${variant} tanpa teks`).toMatch(/text-\[/)
    }
  })
})

describe('escapeCsvCell', () => {
  it('membungkus sel yang berisi baris baru, bukan menghapus baris barunya', () => {
    // Baris baru di dalam tanda kutip tetap baris baru bagi Excel dan sah
    // menurut RFC 4180. Menghapus-newline-nya justru memotong isi sel.
    const hasil = escapeCsvCell('a\nb')
    expect(hasil.startsWith('"') && hasil.endsWith('"')).toBe(true)
    expect(hasil).toContain('\n')
  })

  it('menjaga angka dan teks biasa apa adanya', () => {
    expect(escapeCsvCell('Selesai')).toBe('Selesai')
    expect(escapeCsvCell(42)).toBe('42')
    expect(escapeCsvCell('')).toBe('')
  })

  it('menggandakan tanda kutip di dalam sel yang dibungkus', () => {
    expect(escapeCsvCell('a"b')).toBe('"a""b"')
  })

  it('memberi awalan tab pada nilai yang akan ditafsirkan Excel sebagai formula', () => {
    // Tanpa awalan ini, `=HYPERLINK(...)` di kolom nama akan dieksekusi begitu
    // file dibuka di Excel. Prefiks tab membuat Excel memperlakukannya sebagai teks.
    for (const ncoba of ['=SUM(A1)', '+1', '-1', '@SUM(A1)', '\r']) {
      expect(escapeCsvCell(ncoba), `harus diproteksi: ${ncoba}`).toBe(
        `\t${ncoba}`,
      )
    }
  })

  it('tidak memproteksi nilai yang cuma diawali spasi lalu tanda', () => {
    // Regex sengaja tidak Anchored longgar: spasi sebelum "=" membuat Excel
    // memperlakukannya sebagai teks, jadi tidak perlu prefiks. Kalau suatu saat
    // ini berubah, tes ini yang memberi tahu.
    expect(escapeCsvCell(' =SUM(A1)')).toBe(' =SUM(A1)')
  })
})
