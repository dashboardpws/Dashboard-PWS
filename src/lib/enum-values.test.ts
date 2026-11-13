/**
 * Uji katalog nilai enum (`src/lib/enum-values.ts`).
 *
 * Modul ini adalah sumber kebenaran yang sama dengan enum di database, jadi
 * perubahan daftar berarti perubahan tipe enum — itu `ALTER TYPE`, bukan
 * sekadar edit kode. Test di sini tidak memeriksa isi tiap daftar (nilai
 * memang boleh berubah sesuai keputusan klinis), melainkan memeriksa invarian
 * yang akan menggagalkan database:
 *
 *   1. Tidak ada nilai duplikat dalam satu daftar. `pgEnum` dengan nilai
 *      kembar membuat Postgres menolak, dan `ALTER TYPE ... ADD VALUE` juga.
 *   2. Setiap daftar benar-benar dikonsumsi sebuah `pgEnum` di
 *      `src/lib/schema/type-enum.ts`. Daftar yang terlupa dipakai akan lolos
 *      `tsc` dan review, lalu diam-diam jadi sumber kebenaran yang tidak
 *      pernah masuk ke skema.
 *
 * Yang TIDAK diuji: ejaan dan kapitalisasi nilai. Values satu enum memang
 * tidak konsisten satu sama lain — `JENIS_KELAMIN_VALUES` huruf kecil,
 * `HUBUNGAN_KELUARGA_VALUES` kapitalisasi Judul — jadi aturan umum soal
 * kapitalisasi tidak berlaku di sini dan memaksakannya akan salah.
 *
 * Modul ini sengaja bebas `drizzle-orm` supaya bisa dipakai di sisi klien.
 * Test pun membaca `type-enum.ts` sebagai teks, bukan mengimpornya, supaya
 * ketergantungan itu tidak pecah lewat jalur test.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as katalog from '@/lib/enum-values'

// `as const` pada tiap daftar menjadikannya tuple readonly, jadi `Object.entries`
// menghasilkan tipe yang tidak bisa disaring dengan type predicate. Satu cast ke
// `readonly string[]` cukup karena yang diuji justru bentuk lariknya.
const SEMUA_EKSPOR = Object.entries(katalog as Record<string, unknown>)
const SEMUA_DAFTAR = SEMUA_EKSPOR.filter(
  (entri): entri is [string, readonly string[]] =>
    Array.isArray(entri[1]) && entri[1].every((v) => typeof v === 'string'),
)

const typeEnumSrc = readFileSync(
  fileURLToPath(new URL('./schema/type-enum.ts', import.meta.url)),
  'utf8',
)

describe('katalog nilai enum', () => {
  it('setiap ekspor adalah array string', () => {
    const salahBentuk = SEMUA_EKSPOR.filter(
      ([, nilai]) =>
        !Array.isArray(nilai) || !nilai.every((v) => typeof v === 'string'),
    ).map(([nama]) => nama)
    expect(salahBentuk).toEqual([])
    expect(SEMUA_DAFTAR.map(([nama]) => nama)).toEqual(
      SEMUA_EKSPOR.map(([nama]) => nama),
    )
  })

  it('hanya berisi array string dan tidak kosong', () => {
    // Ambang bawah, bukan jumlah daftar yang harus dijaga: yang diuji adalah
    // katalognya masih hidup (tidak ada daftar yang hilang diam-diam). Jumlahnya
    // turun kalau ada enum yang dihapus — `role` hilang bersama kolomnya di
    // `users`, jadi katalog sekarang ada tujuh daftar.
    expect(SEMUA_DAFTAR.length).toBeGreaterThanOrEqual(7)
    for (const [nama, nilai] of SEMUA_DAFTAR) {
      expect(nilai.length, `${nama} kosong`).toBeGreaterThan(0)
    }
  })

  it('nilai dalam satu daftar unik', () => {
    for (const [nama, nilai] of SEMUA_DAFTAR) {
      const kembar = nilai.filter((v, i) => nilai.indexOf(v) !== i)
      expect(
        kembar,
        `${nama} punya nilai kembar: ${kembar.join(', ')}`,
      ).toEqual([])
    }
  })

  it('nilai tidak kosong dan tidak hanya spasi', () => {
    for (const [nama, nilai] of SEMUA_DAFTAR) {
      for (const v of nilai) {
        expect(v.trim().length, `${nama} punya nilai kosong`).toBeGreaterThan(0)
        expect(v.trim(), `${nama} punya spasi di tepi nilai`).toBe(v)
      }
    }
  })

  it('setiap daftar dikonsumsi pgEnum di type-enum.ts', () => {
    // Kalau satu daftar baru ditambahkan tanpa didaftarkan sebagai enum, `tsc`
    // tetap hijau karena array-nya diekspor dan valid. Yang hilang: kolom enumnya.
    //
    // Regex di bawah harus tahan dua bentuk penulisan. `pgEnum` yang argumennya
    // panjang dipecah prettier jadi beberapa baris DAN diberi koma di akhir,
    // jadi pola `\s*\)` saja tidak akan mematch — enum yang lolos tak sengaja
    // membuat test ini menghitung kurang dari kenyataan dan gagal lewat.
    const enumTerdaftar = new Set(
      [
        ...typeEnumSrc.matchAll(
          /pgEnum\(\s*['"][a-z_]+['"]\s*,\s*([A-Z0-9_]+)\s*,?\s*\)/g,
        ),
      ].map((m) => m[1] ?? ''),
    )
    expect(enumTerdaftar.size).toBeGreaterThanOrEqual(7)

    const takPakai = SEMUA_DAFTAR.map(([nama]) => nama).filter(
      (n) => !enumTerdaftar.has(n),
    )
    expect(
      takPakai,
      `daftar ini tidak dipakai pgEnum mana pun: ${takPakai.join(', ')}`,
    ).toEqual([])
  })

  it('daftar yang dipakai enum tetap ada di modul ini', () => {
    // Kebalikan dari tes di atas: enum yang menunjuk nama yang sudah dihapus.
    const adaDiKatalog = new Set(SEMUA_DAFTAR.map(([nama]) => nama))
    const hilang = [
      ...typeEnumSrc.matchAll(
        /pgEnum\(\s*['"][a-z_]+['"]\s*,\s*([A-Z0-9_]+)\s*,?\s*\)/g,
      ),
    ]
      .map((m) => m[1] ?? '')
      .filter((nama) => !adaDiKatalog.has(nama))
    expect(
      hilang,
      `enum ini menunjuk daftar yang tidak ada: ${hilang.join(', ')}`,
    ).toEqual([])
  })
})
