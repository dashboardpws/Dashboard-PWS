/**
 * Data warga sasaran: pencarian per NIK, daftar bertahap, detail per warga, dan riwayat
 * kunjungan per warga. Helper penyimpanan warga dari record kunjungan juga ada di sini.
 */

import type {
  AnggotaKeluarga,
  KeluargaInfo,
} from '@/lib/kunjungan-rumah/models'
import type {
  BarisWarga,
  SasaranSuggestion,
} from '@/lib/kunjungan-rumah/sasaran/warga-row'
import type { JsonRecord } from './kunjungan-rumah.server'
import type { SQL } from 'drizzle-orm'
import {
  barisDataWargaDariForm,
  keAgama,
  keHubunganKeluarga,
  keJenisKelamin,
  kePendidikan,
  kePekerjaan,
  keStatusKawin,
} from '@/lib/kunjungan-rumah/sasaran/warga-row'
import { dataWargaTable } from '@/lib/schema/schema'
import { db } from './db.server'
import { sql } from 'drizzle-orm'
import { isValidNik } from '@/lib/utils'
import {
  buildPenilaianMapFromSubmission,
  getMemberKey,
} from '@/lib/kunjungan-rumah/penilaian-riwayat'

// ---- pencarian warga sasaran di data_warga + data import ----
//
// `data_warga_import` adalah sumber awal data sasaran: user mengetik NIK atau
// nama KK dan server mencarinya di situ. Begitu warga disimpan lewat Simpan
// (atau sudah ada dari sumber lain), barisnya ada di `data_warga`.
//
// Hasil pencarian menggabungkan keduanya dengan satu aturan: warga yang sudah
// tersimpan di `data_warga` TAMPIL, dan baris `data_warga_import` yang NIK-nya
// sama dengannya TIDAK ikut tampil — supaya nama yang sama tidak muncul dua
// kali. Baris import tanpa NIK 16 digit tidak bisa dicocokkan ke `data_warga`
// (NIK di sana selalu valid), jadi tetap tampil.
//
// Pencocokan selalu `LIKE`, bukan persis: 8.277 dari 20.454 baris import punya
// NIK kosong atau bukan 16 digit, jadi user yang hanya tahu nama KK tetap bisa
// menemukan warga sasarannya.

/** Kolom yang dibaca dari `data_warga_import`, dengan nama kolom aslinya. */
const SELECT_SASARAN = sql`
    raw_id                       AS "rawId",
    jumlah_art                   AS "jumlahArt",
    nik                          AS "nik",
    nama_art                     AS "namaArt",
    nama_kk                      AS "namaKk",
    hubungan_keluarga            AS "hubunganKeluarga",
    to_char(tgl_lahir, 'YYYY-MM-DD') AS "tglLahir",
    jenis_kelamin                AS "jenisKelamin",
    status_kawin                 AS "statusKawin",
    agama                        AS "agama",
    pendidikan                   AS "pendidikan",
    pekerjaan                    AS "pekerjaan",
    alamat                       AS "alamat",
    rt::text                     AS "rt",
    rw::text                     AS "rw",
    kecamatan                    AS "kecamatan",
    kelurahan                    AS "kelurahan",
    kab_kota                     AS "kabKota",
    provinsi                     AS "provinsi"
`

/** Kolom yang dibaca dari `data_warga` (sudah tersimpan), proyeksi sama dengan
 *  `SELECT_SASARAN` supaya pemanggil tidak perlu tahu asal barisnya. `data_warga`
 *  tidak punya `raw_id`/`provinsi`, jadi NIK dipakai sebagai `rawId` (unik — dia
 *  primary key) dan `provinsi` diisi NULL. */
const SELECT_SASARAN_WARGA = sql`
    nik                          AS "rawId",
    nik                          AS "nik",
    nama_art                     AS "namaArt",
    nama_kk                      AS "namaKk",
    hubungan_keluarga            AS "hubunganKeluarga",
    to_char(tgl_lahir, 'YYYY-MM-DD') AS "tglLahir",
    jenis_kelamin                AS "jenisKelamin",
    status_kawin                 AS "statusKawin",
    agama                        AS "agama",
    pendidikan                   AS "pendidikan",
    pekerjaan                    AS "pekerjaan",
    alamat                       AS "alamat",
    rt                           AS "rt",
    rw                           AS "rw",
    kecamatan                    AS "kecamatan",
    kelurahan                    AS "kelurahan",
    kota                         AS "kabKota",
    NULL                         AS "provinsi"
`

type BarisImportSasaran = {
  rawId?: unknown
  /** Hanya ada di `data_warga_import`; dipakai sebagai batas jumlah anggota. */
  jumlahArt?: unknown
  nik?: unknown
  namaArt?: unknown
  namaKk?: unknown
  hubunganKeluarga?: unknown
  tglLahir?: unknown
  jenisKelamin?: unknown
  statusKawin?: unknown
  agama?: unknown
  pendidikan?: unknown
  pekerjaan?: unknown
  alamat?: unknown
  rt?: unknown
  rw?: unknown
  kecamatan?: unknown
  kelurahan?: unknown
  kabKota?: unknown
  provinsi?: unknown
}

/** Terjemahkan baris import ke label enum `data_warga`; yang tak cocok jadi `null`. */
function normalkanSasaran(row: BarisImportSasaran): SasaranSuggestion {
  const s = (v: unknown) =>
    typeof v === 'string' && v.trim() ? v.trim() : null
  const jumlahArt =
    typeof row.jumlahArt === 'number' && Number.isFinite(row.jumlahArt)
      ? row.jumlahArt
      : // Driver PostgreSQL kadang mengirim smallint sebagai teks, jadi dua bentuk
        // ini harus diterima.
        typeof row.jumlahArt === 'string' && row.jumlahArt.trim()
        ? Number(row.jumlahArt)
        : null
  return {
    rawId: s(row.rawId) ?? '',
    jumlahArt:
      jumlahArt !== null && Number.isFinite(jumlahArt) && jumlahArt > 0
        ? jumlahArt
        : null,
    nik: s(row.nik) ?? '',
    namaArt: s(row.namaArt) ?? '',
    namaKk: s(row.namaKk) ?? '',
    hubunganKeluarga: keHubunganKeluarga(s(row.hubunganKeluarga)),
    tglLahir: s(row.tglLahir),
    jenisKelamin: keJenisKelamin(s(row.jenisKelamin)),
    statusKawin: keStatusKawin(s(row.statusKawin)),
    agama: keAgama(s(row.agama)),
    pendidikan: kePendidikan(s(row.pendidikan)),
    pekerjaan: kePekerjaan(s(row.pekerjaan)),
    alamat: s(row.alamat),
    rt: s(row.rt),
    rw: s(row.rw),
    kecamatan: s(row.kecamatan),
    kelurahan: s(row.kelurahan),
    kabKota: s(row.kabKota),
    provinsi: s(row.provinsi),
  }
}

// `SELECT_SASARAN` menyatukan bentuk data dari tabel warga dan tabel import.
// Nama kolom enum import sudah dipetakan eksplisit di schema agar sesuai dengan
// kolom database snake_case; query tetap ditulis manual karena kedua sumber
// memakai tipe dan kolom yang berbeda, termasuk `rt`/`rw` yang perlu jadi teks.

/**
 * Cari warga sasaran di `data_warga` dan `data_warga_import` yang mirip `q`.
 *
 * Warga yang sudah tersimpan di `data_warga` selalu tampil; baris import dengan
 * NIK yang sama dibuang supaya tidak duplikat. `q` dicocokkan ke NIK,
 * nama.artikel, dan nama KK. Urutan: NIK yang persis dulu, lalu sisanya.
 */
export async function querySasaranWarga(
  q: string,
): Promise<SasaranSuggestion[]> {
  const cari = q.trim()
  if (cari.length < 3) return []
  const pola = `%${cari}%`
  const where = sql`WHERE nik ILIKE ${pola} OR nama_art ILIKE ${pola} OR nama_kk ILIKE ${pola}`
  const [barisWarga, barisImport] = await Promise.all([
    db.execute(
      sql`SELECT ${SELECT_SASARAN_WARGA} FROM data_warga ${where} ORDER BY nik LIMIT 30`,
    ),
    db.execute(
      sql`SELECT ${SELECT_SASARAN} FROM data_warga_import ${where} ORDER BY raw_id LIMIT 30`,
    ),
  ])
  const warga = (barisWarga as unknown as BarisImportSasaran[]).map(
    normalkanSasaran,
  )

  // Buang baris import yang NIK-nya sudah tersimpan di `data_warga`. Baris
  // import tanpa NIK tetap dipertahankan: tidak bisa dicocokkan, dan user
  // tetap bisa mengambil nama/alamatnya.
  const nikWarga = new Set(
    warga.map((r) => r.nik).filter((n) => n.length === 16),
  )
  const importSisa = (barisImport as unknown as BarisImportSasaran[])
    .map(normalkanSasaran)
    .filter((r) => !r.nik || r.nik.length !== 16 || !nikWarga.has(r.nik))

  const hasil = [...warga, ...importSisa].slice(0, 30)
  // NIK persis naik ke atas supaya suggestion yang paling mungkin benar lebih dulu.
  return hasil.sort((a, b) => {
    const aTepat = a.nik === cari ? 0 : 1
    const bTepat = b.nik === cari ? 0 : 1
    return aTepat - bTepat || a.rawId.localeCompare(b.rawId)
  })
}

/**
 * Semua warga dalam satu keluarga, untuk mengisi tabel anggota otomatis.
 *
 * `nama_kk` sendirinya bukan kunci: satu nama dipakai banyak keluarga, sehingga
 * pencarian_longgar sekali bisa menarik puluhan baris. Dua lapis penyempit, dari
 * yang paling membedakan:
 *
 * 1. **Alamat.** `nama_kk` + `kelurahan` + `kecamatan` + `rt` + `rw`. Alamat
 *    adalah satu-satunya pembeda yang tersedia di tabel; tidak ada `nomor_kk`.
 *    `rt`/`rw` dibandingkan sebagai teks setelah `NULLIF` supaya baris dengan
 *    satu-duanya `NULL` (yang akan jadi sama dengan baris lain yang juga NULL)
 *    tidak otomatis dianggap satu keluarga. Kalau alamat tidak bisa dipakai —
 *    semua NULL — pencarian turun ke `nama_kk` saja, dan hasilnya tetap
 *    berlebihan.
 * 2. **`jumlah_art`.** Jumlah anggota yang tercatat per kepala keluarga pada
 *    baris warga yang dipilih. Ini pembatas alami: ambil hanya N baris teratas
 *    sesuai urutan. Tidak ada di tabel `data_warga`, jadi batas itu hanya
 *    berlaku kalau `data_warga_import` menyumbang baris ke keluarga itu.
 *
 * Urutan baris penting karena pemotongan `jumlah_art` mengambil N teratas:
 * kepala keluarga dulu (nama warga sama dengan nama KK), lalu nama warga.
 * Baris import dengan NIK yang sudah tersimpan di `data_warga` dibuang supaya
 * tidak dobel, sama seperti di {@link querySasaranWarga}.
 *
 * `alamat` sengaja tidak dipakai sebagai kunci: kolom itu teks bebas dan pasti
 * beda ejaan antar baris ("gg. III" vs "Gg III"), sehingga menyamakannya akan
 * memotong anggota yang sebenarnya satu keluarga.
 */
export async function queryAnggotaKeluarga(kunci: {
  namaKk: string
  nik: string
  /** Alamat baris yang dipilih; menyempitkan pencarian agar satu KK saja. */
  kelurahan?: string | null
  kecamatan?: string | null
  rt?: string | null
  rw?: string | null
  /** `jumlah_art` baris yang dipilih; batas anggota yang boleh masuk. */
  jumlahArt?: number | null
}): Promise<SasaranSuggestion[]> {
  const namaKk = kunci.namaKk.trim()
  const nik = kunci.nik.trim()
  if (!namaKk && !nik) return []

  // Alamat hanya menyempitkan kalau ada isinya. Tanpa alamat, memakai
  // `NULLIF`-nya justru membuat semua baris tanpa rt/rw tampak satu keluarga.
  const alamatPakai =
    !!(kunci.kelurahan?.trim() || kunci.kecamatan?.trim()) ||
    !!kunci.rt?.trim() ||
    !!kunci.rw?.trim()

  const syaratNama = sql`btrim(nama_kk) ILIKE ${namaKk}`
  // `IS NOT DISTINCT FROM` dipakai supaya NULL di sisi database dianggap sama
  // dengan NULL di sisi parameter: baris yang rt/rw-nya kosong tidak boleh
  // tercampur dengan baris yang rt/rw-nya terisi. `NULLIF` di sisi kolom
  // menormalkan string kosong jadi NULL supaya keduanya tidak berbeda.
  const syaratAlamat = sql`
    NULLIF(btrim(kelurahan::text), '') IS NOT DISTINCT FROM NULLIF(${kunci.kelurahan ?? null}, '')
    AND NULLIF(btrim(kecamatan::text), '') IS NOT DISTINCT FROM NULLIF(${kunci.kecamatan ?? null}, '')
    AND NULLIF(btrim(rt::text), '') IS NOT DISTINCT FROM NULLIF(${kunci.rt ?? null}, '')
    AND NULLIF(btrim(rw::text), '') IS NOT DISTINCT FROM NULLIF(${kunci.rw ?? null}, '')
  `
  const syaratKeluarga = namaKk
    ? alamatPakai
      ? sql`(${syaratNama} AND ${syaratAlamat})`
      : syaratNama
    : nik
      ? sql`btrim(nik) = ${nik}`
      : sql`false`
  const syaratFinal = nik
    ? sql`(${syaratKeluarga} OR btrim(nik) = ${nik})`
    : syaratKeluarga

  // `data_warga` tidak punya `jumlah_art`, dan rt/rw-nya NOT NULL varchar —
  // bukan smallint nullable seperti di import. Kedua perbedaan itu ditangani
  // lewat `::text` di `syaratAlamat` dan batas jumlah yang hanya berlaku kalau
  // ada baris import.
  const [barisWarga, barisImport] = await Promise.all([
    db.execute(
      sql`SELECT ${SELECT_SASARAN_WARGA} FROM data_warga WHERE ${syaratFinal} LIMIT 60`,
    ),
    db.execute(
      sql`SELECT ${SELECT_SASARAN} FROM data_warga_import WHERE ${syaratFinal} LIMIT 60`,
    ),
  ])
  const warga = (barisWarga as unknown as BarisImportSasaran[]).map(
    normalkanSasaran,
  )
  const nikWarga = new Set(
    warga.map((r) => r.nik).filter((n) => n.length === 16),
  )
  const importSisa = (barisImport as unknown as BarisImportSasaran[])
    .map(normalkanSasaran)
    .filter((r) => !r.nik || r.nik.length !== 16 || !nikWarga.has(r.nik))

  const semua = [...warga, ...importSisa]
  // Baris tanpa NIK masih bisa sama persis (nama dan KK sama), jadi dedupe
  // memakai nama kalau NIK tidak bisa jadi kunci.
  const terlihat = new Set<string>()
  const unik = semua.filter((r) => {
    const kunciBaris = r.nik || `${r.namaArt}|${r.namaKk}`
    if (terlihat.has(kunciBaris)) return false
    terlihat.add(kunciBaris)
    return true
  })

  const terurut = unik.sort((a, b) => {
    const aKepala = a.namaKk && a.namaArt === a.namaKk ? 0 : 1
    const bKepala = b.namaKk && b.namaArt === b.namaKk ? 0 : 1
    return aKepala - bKepala || a.namaArt.localeCompare(b.namaArt)
  })

  // `jumlah_art` hanya dipakai kalau minimal ada baris import di keluarga ini;
  // kalau seluruh anggota berasal dari `data_warga`, tidak ada angka yang bisa
  // dipercaya sebagai batas dan memotong anggota akan lebih harmful daripada
  // kelebihan.
  const jumlah = kunci.jumlahArt
  const adaBarisImport = importSisa.length > 0
  const terlihatAkhir =
    typeof jumlah === 'number' &&
    Number.isFinite(jumlah) &&
    jumlah > 0 &&
    adaBarisImport &&
    terurut.length > jumlah
      ? terurut.slice(0, jumlah)
      : terurut
  const terbaru = await anggotaSubmissionTerbaru(kunci)
  return gabungkanDenganSubmissionTerbaru(terlihatAkhir, terbaru).sort(
    (a, b) => {
      const aKepala = a.namaKk && a.namaArt === a.namaKk ? 0 : 1
      const bKepala = b.namaKk && b.namaArt === b.namaKk ? 0 : 1
      return aKepala - bKepala || a.namaArt.localeCompare(b.namaArt)
    },
  )
}

/** Baris import untuk satu NIK; dipakai server saat menyimpan agar kolom yang
 *  tidak ada di form (`rt`, `rw`, `agama`) tetap terisi tanpa kirim round-trip. */
async function importUntukNik(nik: string): Promise<SasaranSuggestion | null> {
  const rows = await db.execute(sql`
        SELECT ${SELECT_SASARAN}
        FROM data_warga_import
        WHERE nik = ${nik}
        LIMIT 1
    `)
  const [row] = rows as unknown as BarisImportSasaran[]
  return row ? normalkanSasaran(row) : null
}

/** Gabungkan master tersimpan dan import sebagai fallback sebelum memakai form. */
async function saranDasarUntukNik(
  nik: string,
): Promise<SasaranSuggestion | null> {
  const [tersimpan, imported] = await Promise.all([
    db.execute(
      sql`SELECT ${SELECT_SASARAN_WARGA} FROM data_warga WHERE nik = ${nik} LIMIT 1`,
    ),
    importUntukNik(nik),
  ])
  const row = (tersimpan as unknown as BarisImportSasaran[])[0]
  const utama = row ? normalkanSasaran(row) : null
  if (!utama) return imported
  if (!imported) return utama
  const hasil = { ...imported, ...utama, jumlahArt: imported.jumlahArt }
  for (const key of Object.keys(hasil) as Array<keyof SasaranSuggestion>) {
    const nilai = hasil[key]
    if ((nilai === null || nilai === '') && imported[key] != null)
      Object.assign(hasil, { [key]: imported[key] })
  }
  return hasil
}

/** Payload KR terbaru yang menyebut warga ini sebagai sasaran. */
async function payloadSubmissionTerbaru(kunci: {
  nik?: string
  namaKk?: string
  kelurahan?: string | null
  kecamatan?: string | null
  rt?: string | null
  rw?: string | null
}): Promise<Record<string, unknown> | null> {
  const nik = kunci.nik?.trim() ?? ''
  const rows = await db.execute(sql`
    SELECT e.value
    FROM surveys s
    JOIN survey_entries e ON e."surveyId" = s.id
    JOIN form_versions fv ON fv.id = s."formVersionId"
    CROSS JOIN LATERAL jsonb_array_elements(fv."schema"->'sections') section
    CROSS JOIN LATERAL jsonb_array_elements(section->'fields') field
    WHERE field->>'id' = e."fieldId"::text
      AND field->>'name' = 'penyimpanan::record_legacy'
      AND (
        (
          ${nik} <> ''
          AND (
            s."wargaNik" = ${nik}
            OR EXISTS (
              SELECT 1
              FROM jsonb_array_elements(
                CASE
                  WHEN jsonb_typeof(e.value->'anggota') = 'array'
                    THEN e.value->'anggota'
                  WHEN jsonb_typeof(e.value->'anggotaKeluarga') = 'array'
                    THEN e.value->'anggotaKeluarga'
                  ELSE '[]'::jsonb
                END
              ) anggota
              WHERE anggota->>'nik' = ${nik}
            )
          )
        )
        OR (
          ${nik} = ''
          AND e.value->'info'->>'namaKK' = ${kunci.namaKk ?? ''}
          AND NULLIF(e.value->'info'->>'kelurahan', '') IS NOT DISTINCT FROM NULLIF(${kunci.kelurahan ?? null}, '')
          AND NULLIF(e.value->'info'->>'kecamatan', '') IS NOT DISTINCT FROM NULLIF(${kunci.kecamatan ?? null}, '')
          AND NULLIF(e.value->'info'->>'rt', '') IS NOT DISTINCT FROM NULLIF(${kunci.rt ?? null}, '')
          AND NULLIF(e.value->'info'->>'rw', '') IS NOT DISTINCT FROM NULLIF(${kunci.rw ?? null}, '')
        )
      )
    ORDER BY e."createdAt" DESC
    LIMIT 1
  `)
  const payload = (rows[0] as { value?: unknown } | undefined)?.value
  if (!payload || typeof payload !== 'object' || Array.isArray(payload))
    return null
  return payload as Record<string, unknown>
}

export async function queryPenilaianKRTerbaru(
  kunci: Parameters<typeof payloadSubmissionTerbaru>[0],
): Promise<
  Record<
    string,
    import('@/lib/kunjungan-rumah/penilaian-riwayat').PenilaianRiwayat[]
  >
> {
  if (!isValidNik(kunci.nik ?? '') && !kunci.namaKk?.trim()) return {}
  const payload = await payloadSubmissionTerbaru(kunci)
  return payload ? buildPenilaianMapFromSubmission(payload) : {}
}

/** Anggota dari submission KR terbaru yang menyebut warga ini sebagai sasaran. */
async function anggotaSubmissionTerbaru(
  kunci: Parameters<typeof payloadSubmissionTerbaru>[0],
): Promise<SasaranSuggestion[]> {
  const rec = await payloadSubmissionTerbaru(kunci)
  if (!rec) return []
  const info = (rec.info ?? {}) as Record<string, unknown>
  const anggota = Array.isArray(rec.anggota)
    ? rec.anggota
    : Array.isArray(rec.anggotaKeluarga)
      ? rec.anggotaKeluarga
      : []
  return anggota.flatMap((item): SasaranSuggestion[] => {
    if (!item || typeof item !== 'object') return []
    const a = item as Record<string, unknown>
    const nikAnggota = typeof a.nik === 'string' ? a.nik.trim() : ''
    if (!nikAnggota && !(typeof a.nama === 'string' && a.nama.trim())) return []
    return [
      normalkanSasaran({
        rawId: nikAnggota,
        nik: nikAnggota,
        namaArt: a.nama,
        namaKk: info.namaKK,
        hubunganKeluarga: a.hubKK,
        tglLahir: a.tglLahir,
        jenisKelamin: a.jk,
        statusKawin: a.statusKawin,
        agama: a.agama,
        pendidikan: a.pendidikan,
        pekerjaan: a.pekerjaan,
        alamat: info.alamat,
        rt: info.rt,
        rw: info.rw,
        kecamatan: info.kecamatan,
        kelurahan: info.kelurahan,
        kabKota: info.kabKota,
        provinsi: info.provinsi,
      }),
    ]
  })
}

function gabungkanDenganSubmissionTerbaru(
  awal: SasaranSuggestion[],
  terbaru: SasaranSuggestion[],
): SasaranSuggestion[] {
  const kunci = (warga: SasaranSuggestion) =>
    getMemberKey({
      nik: warga.nik,
      nama: warga.namaArt,
      tglLahir: warga.tglLahir,
      hubunganKeluarga: warga.hubunganKeluarga,
    }) ?? `name_household:${warga.namaArt}|${warga.namaKk}`
  const hasil = new Map(awal.map((warga) => [kunci(warga), warga]))
  for (const warga of terbaru) {
    const key = kunci(warga)
    const sebelumnya = hasil.get(key)
    hasil.set(key, {
      ...(sebelumnya ?? warga),
      ...Object.fromEntries(
        Object.entries(warga).filter(
          ([key, value]) =>
            key !== 'rawId' &&
            key !== 'jumlahArt' &&
            value !== null &&
            value !== '',
        ),
      ),
    })
  }
  return [...hasil.values()]
}

/** Pesan error berbahasa petugas untuk kolom `data_warga` yang belum terisi. */
const LABEL_KOLOM_WARGA: Record<string, string> = {
  nama_art: 'nama warga sasaran',
  nama_kk: 'nama kepala keluarga',
  hubungan_keluarga: 'hubungan dengan kepala keluarga',
  alamat: 'alamat',
  tgl_lahir: 'tanggal lahir warga sasaran',
  rt: 'RT',
  rw: 'RW',
  kecamatan: 'kecamatan',
  kelurahan: 'kelurahan',
  kota: 'kota/kabupaten',
  status_kawin: 'status perkawinan',
  staff: 'petugas',
  jenis_kelamin: 'jenis kelamin warga sasaran',
  agama: 'agama warga sasaran',
  pendidikan: 'pendidikan warga sasaran',
  pekerjaan: 'pekerjaan warga sasaran',
}

export /**
 * Perbarui data master seluruh anggota yang lengkap berdasarkan isian KR.
 *
 * Disimpan dalam transaksi yang sama dengan submission supaya pencarian dan
 * autofill berikutnya memakai koreksi terbaru dari kader.
 */
async function simpanWargaSasaran(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  baris: BarisWarga[],
): Promise<void> {
  for (const warga of baris) {
    await tx
      .insert(dataWargaTable)
      .values(warga)
      .onConflictDoUpdate({
        target: dataWargaTable.nik,
        set: {
          nama_art: warga.nama_art,
          nama_kk: warga.nama_kk,
          hubungan_keluarga: warga.hubungan_keluarga,
          alamat: warga.alamat,
          tgl_lahir: warga.tgl_lahir,
          rt: warga.rt,
          rw: warga.rw,
          kecamatan: warga.kecamatan,
          kelurahan: warga.kelurahan,
          kota: warga.kota,
          status_kawin: warga.status_kawin,
          staff: warga.staff,
          jenis_kelamin: warga.jenis_kelamin,
          agama: warga.agama,
          pendidikan: warga.pendidikan,
          pekerjaan: warga.pekerjaan,
          updatedAt: new Date(),
        },
      })
  }
}

export /** Susun baris `data_warga` dari payload form, atau lempar error yang menyebut
 *  kolom yang kurang. Semua sumber sudah dinormalkan di `warga-row.ts`. */
async function barisWargaDariPayload(rec: JsonRecord): Promise<BarisWarga> {
  const info = (rec.info ?? {}) as JsonRecord
  const anggota = Array.isArray(rec.anggota)
    ? (rec.anggota as AnggotaKeluarga[])
    : []
  const suggestion = await saranDasarUntukNik(
    (typeof info.nik === 'string' ? info.nik : '').trim(),
  )
  const { nilai, hilang } = barisDataWargaDariForm({
    info: info as unknown as KeluargaInfo,
    anggota,
    suggestion,
  })
  if (nilai) return nilai
  if (hilang.includes('anggota')) {
    throw new Error(
      'Daftar anggota keluarga harus memuat NIK yang sama dengan NIK sasaran utama, agar data warga bisa disimpan.',
    )
  }
  throw new Error(
    `Data warga sasaran belum lengkap. Isi dulu di form: ${hilang.map((k) => LABEL_KOLOM_WARGA[k] ?? k).join(', ')}.`,
  )
}

/** Siapkan pembaruan data master untuk setiap anggota yang datanya lengkap. */
export async function barisWargaKeluargaDariPayload(
  rec: JsonRecord,
): Promise<BarisWarga[]> {
  const utama = await barisWargaDariPayload(rec)
  const info = (rec.info ?? {}) as JsonRecord
  const anggota = Array.isArray(rec.anggota)
    ? (rec.anggota as AnggotaKeluarga[])
    : []
  const baris = new Map([[utama.nik, utama]])

  for (const warga of anggota) {
    const nik = warga.nik.trim()
    if (!isValidNik(nik) || baris.has(nik)) continue
    const suggestion = await saranDasarUntukNik(nik)
    const { nilai } = barisDataWargaDariForm({
      info: { ...info, nik } as unknown as KeluargaInfo,
      anggota: [warga],
      suggestion,
    })
    if (nilai) baris.set(nik, nilai)
  }

  return [...baris.values()]
}

// ---- read model DB (sumber tunggal UI; tanpa data dummy) ----
export async function queryWargaList() {
  return await db.query.dataWargaTable.findMany({
    columns: {
      nik: true,
      nama_art: true,
      nama_kk: true,
      kelurahan: true,
      kecamatan: true,
      kota: true,
      rt: true,
      rw: true,
      alamat: true,
      tgl_lahir: true,
      jenis_kelamin: true,
    },
    orderBy: (t, { asc }) => [asc(t.nama_art)],
  })
}

// ---- sumber data awal UI sasaran (gabungan import) ----
/**
 * Baris sasaran gabungan (`data_warga` + `data_warga_import`) yang ditampilkan
 * di halaman /sasaran.
 *
 * - `rawId`    — identitas asal baris: NIK untuk `data_warga`, `raw_id`
 *   (`WRG-000001`) untuk import. Dipakai sebagai pengunci detail, bukan NIK.
 * - `nik`      — NIK asli 16 digit kalau valid; kalau tidak ada/tersimpan salah
 *   (bukan 16 digit), diganti "NIK sementara" hasil derive nomor `raw_id`
 *   (`WRG-000123` → `0000000000000123`) sebagai penanda data perlu diperbarui.
 * - `nikValid` / `needsUpdate` — turunan dari status NIK; UI memakai `needsUpdate`
 *   untuk badge peringatan dan menolak menyimpan NIK sementara sebagai NIK asli.
 *
 * NIK yang sama di kedua tabel diutamakan baris `data_warga` — isinya sudah
 * diverifikasi petugas, jadi import tidak menimpanya. Kolom tanpa padanan
 * (`provinsi`, `iks_besar`) tidak diproyeksikan, dan tidak ada yang ditebak.
 */
export type BarisWargaGabungan = {
  rawId: string
  nik: string
  nikValid: boolean
  needsUpdate: boolean
  nama_art: string
  nama_kk: string
  kelurahan: string
  kecamatan: string
  kota: string
  rt: string
  rw: string
  alamat: string
  tgl_lahir: string
  jenis_kelamin: string
}

/** Proyeksi `data_warga` untuk sumber gabungan. Semua kolomnya `NOT NULL` dan
 *  `rt`/`rw` sudah varchar; NIK selalu valid, `rawId` = NIK. */
const SELECT_GABUNGAN_WARGA = sql`
    1                                 AS "prioritas",
    nik                              AS "raw_id",
    nik                              AS "nik_tampil",
    true                             AS "nik_valid",
    false                            AS "needs_update",
    nik                              AS "nik",
    nama_art                         AS "nama_art",
    nama_kk                          AS "nama_kk",
    kelurahan                        AS "kelurahan",
    kecamatan                        AS "kecamatan",
    kota                             AS "kota",
    rt                               AS "rt",
    rw                               AS "rw",
    alamat                           AS "alamat",
    to_char(tgl_lahir, 'YYYY-MM-DD') AS "tgl_lahir",
    jenis_kelamin::text              AS "jenis_kelamin"
`

/** Proyeksi `data_warga_import` ke nama field yang sama. `raw_id` dipakai sebagai
 *  `rawId`; NIK yang bukan 16 digit tidak bisa dipakai sebagai pengunci, jadi
 *  diganti "NIK sementara" hasil derive dari nomor `raw_id` (`WRG-000123` →
 *  `0000000000000123`). NIK sementara sama uniknya dengan `raw_id`, jadi aman
 *  untuk key React dan pencarian, dan `needs_update` menandai data perlu
 *  diperbarui. Kolom tanpa padanan dikosongkan, bukan ditebak. */
const SELECT_GABUNGAN_IMPORT = sql`
    2                                 AS "prioritas",
    raw_id                           AS "raw_id",
    CASE WHEN length(btrim(nik)) = 16 THEN btrim(nik)
         ELSE lpad(regexp_replace(raw_id, '[^0-9]', '', 'g'), 16, '0')
    END                              AS "nik_tampil",
    (COALESCE(length(btrim(nik)), 0) = 16)  AS "nik_valid",
    (COALESCE(length(btrim(nik)), 0) <> 16) AS "needs_update",
    COALESCE(btrim(nik), '')                     AS "nik",
    COALESCE(btrim(nama_art), '')                AS "nama_art",
    COALESCE(btrim(nama_kk), '')                 AS "nama_kk",
    COALESCE(btrim(kelurahan), '')               AS "kelurahan",
    COALESCE(btrim(kecamatan), '')               AS "kecamatan",
    COALESCE(btrim(kab_kota), '')                AS "kota",
    COALESCE(rt::text, '')                       AS "rt",
    COALESCE(rw::text, '')                       AS "rw",
    COALESCE(btrim(alamat), '')                  AS "alamat",
    COALESCE(to_char(tgl_lahir, 'YYYY-MM-DD'), '') AS "tgl_lahir",
    COALESCE(jenis_kelamin::text, '')             AS "jenis_kelamin"
`

/** Kolom `riwayat_ks_import` (nama camelCase) yang ditambahkan opsional ke baris
 *  warga di halaman detail sasaran. Tidak ada padanannya di `data_warga`, jadi
 *  nilainya dibiarkan apa adanya dari DB — `null` kalau baris riwayatnya tidak
 *  ada. Daftar kolomnya sudah ada di `SELECT_RIWAYAT_KS`. */
export type RiwayatSasaran = Record<string, boolean | number | string | null>

/** Parameter pencarian daftar sasaran. Semua opsional; `all` mengabaikan
 *  `page`/`pageSize` (dipakai ekspor seluruh data). */
export interface QuerySasaranParams {
  q: string
  status: 'all' | 'Sudah' | 'Belum'
  kel: string
  page: number
  pageSize: number
  all: boolean
}

/** Daftar warga sasaran satu halaman, lengkap dengan total (semua filter) dan
 *  jumlah per status. Sumber = `data_warga` digabung `data_warga_import`,
 *  di-dedupe per NIK (atau NIK sementara untuk import), `data_warga` menang.
 *
 * Filter dan halaman diproses di server supaya transfer antar jaringan kecil —
 *  hanya baris satu halaman (maks 10) yang dikirim, bukan 20 ribu baris import.
 *  `COUNT(*) OVER ()` sekaligus menghitung total setelah filter tanpa query kedua.
 */
export async function querySasaranListPaged(
  p: QuerySasaranParams,
): Promise<{ rows: BarisWargaGabungan[]; total: number }> {
  const q = p.q.trim()
  const where: SQL[] = []

  if (q) {
    const pola = `%${q}%`
    where.push(
      sql`(g."nama_art" ILIKE ${pola} OR g."nama_kk" ILIKE ${pola} OR g."nik_tampil" ILIKE ${pola})`,
    )
  }
  if (p.kel && p.kel !== 'all') {
    where.push(sql`g."kelurahan" = ${p.kel}`)
  }
  if (p.status === 'Sudah' || p.status === 'Belum') {
    const ada = sql`EXISTS (
      SELECT 1 FROM surveys s WHERE s."wargaNik" = g."nik_tampil"
      UNION ALL
      SELECT 1
      FROM surveys s
      JOIN survey_entries e ON e."surveyId" = s.id
      JOIN form_versions fv ON fv.id = s."formVersionId"
      CROSS JOIN LATERAL jsonb_array_elements(fv."schema"->'sections') section
      CROSS JOIN LATERAL jsonb_array_elements(section->'fields') field
      CROSS JOIN LATERAL jsonb_array_elements(
        CASE WHEN jsonb_typeof(e.value->'anggota') = 'array'
          THEN e.value->'anggota' ELSE '[]'::jsonb END
      ) anggota
      WHERE field->>'id' = e."fieldId"::text
        AND field->>'name' = 'penyimpanan::record_legacy'
        AND anggota->>'nik' = g."nik_tampil"
    )`
    where.push(p.status === 'Sudah' ? ada : sql`NOT ${ada}`)
  }

  const whereSql = where.length
    ? sql`WHERE ${sql.join(where, sql` AND `)}`
    : sql``
  const limit = p.all ? null : p.pageSize
  const offset = p.all ? null : (p.page - 1) * p.pageSize
  // LIMIT/OFFSET sebagai bind parameter, bukan `sql.raw`. `sql.raw` menerima
  // teks SQL mentah, jadi nilainya jadi bagian dari query — aman hanya
  // selama tipe `number` yang menahan, dan tipe itu tidak ditegakkan runtime.
  const batas = limit !== null ? sql`LIMIT ${limit} OFFSET ${offset}` : sql``

  const rows = await db.execute(sql`
        WITH gabungan AS (
            SELECT DISTINCT ON (u."nik_tampil")
                u."raw_id", u."nik_tampil", u."nik_valid", u."needs_update",
                u."nama_art", u."nama_kk", u."kelurahan", u."kecamatan", u."kota",
                u."rt", u."rw", u."alamat", u."tgl_lahir", u."jenis_kelamin"
            FROM (
                SELECT ${SELECT_GABUNGAN_WARGA}
                FROM data_warga
                UNION ALL
                SELECT ${SELECT_GABUNGAN_IMPORT}
                FROM data_warga_import
            ) u
            ORDER BY u."nik_tampil", u."prioritas"
        )
        SELECT g.*, COUNT(*) OVER () AS "total"
        FROM gabungan g
        ${whereSql}
        ORDER BY g."nama_art" ASC, g."nik_tampil"
        ${batas}
    `)
  const rowsOut = (rows as unknown as Array<Record<string, unknown>>).map(
    (r) => ({
      rawId: String(r.raw_id ?? ''),
      nik: String(r.nik_tampil ?? ''),
      nikValid: Boolean(r.nik_valid),
      needsUpdate: Boolean(r.needs_update),
      nama_art: String(r.nama_art ?? ''),
      nama_kk: String(r.nama_kk ?? ''),
      kelurahan: String(r.kelurahan ?? ''),
      kecamatan: String(r.kecamatan ?? ''),
      kota: String(r.kota ?? ''),
      rt: String(r.rt ?? ''),
      rw: String(r.rw ?? ''),
      alamat: String(r.alamat ?? ''),
      tgl_lahir: String(r.tgl_lahir ?? ''),
      jenis_kelamin: String(r.jenis_kelamin ?? ''),
    }),
  )
  const total = rowsOut.length
    ? Number((rows[0] as { total?: unknown }).total ?? rowsOut.length)
    : rowsOut.length
  return { rows: rowsOut, total }
}

/** Ambil satu baris sasaran gabungan berdasarkan NIK tampil (NIK asli 16 digit
 *  atau NIK sementara hasil derive). Baris `data_warga` diutamakan kalau NIK-nya
 *  juga ada di import — sama seperti daftar. Dipakai halaman detail (ejaan
 *  `querySasaranDetail`), bukan scan daftar penuh. */
export async function querySasaranByNik(
  nik: string,
): Promise<BarisWargaGabungan | null> {
  const cari = nik.trim()
  if (!cari) return null
  const rows = await db.execute(sql`
        SELECT ${SELECT_GABUNGAN_WARGA}
        FROM data_warga
        WHERE nik = ${cari}
        UNION ALL
        SELECT ${SELECT_GABUNGAN_IMPORT}
        FROM data_warga_import
        WHERE btrim(nik) = ${cari} OR lpad(regexp_replace(raw_id, '[^0-9]', '', 'g'), 16, '0') = ${cari}
        ORDER BY "prioritas"
        LIMIT 1
    `)
  const [row] = rows as unknown as Array<Record<string, unknown>>
  if (!row) return null
  return {
    rawId: String(row.raw_id ?? ''),
    nik: String(row.nik_tampil ?? ''),
    nikValid: Boolean(row.nik_valid),
    needsUpdate: Boolean(row.needs_update),
    nama_art: String(row.nama_art ?? ''),
    nama_kk: String(row.nama_kk ?? ''),
    kelurahan: String(row.kelurahan ?? ''),
    kecamatan: String(row.kecamatan ?? ''),
    kota: String(row.kota ?? ''),
    rt: String(row.rt ?? ''),
    rw: String(row.rw ?? ''),
    alamat: String(row.alamat ?? ''),
    tgl_lahir: String(row.tgl_lahir ?? ''),
    jenis_kelamin: String(row.jenis_kelamin ?? ''),
  }
}

const SELECT_RIWAYAT_KS = sql`
    kepesertaan_jkn                     AS "kepesertaanJkn",
   merokok                                AS "merokok",
    tersedia_sarana_air_bersih          AS "tersediaSaranaAirBersih",
    jenis_sumber_air_terlindung         AS "jenisSumberAirTerlindung",
    tersedia_jamban_keluarga            AS "tersediaJambanKeluarga",
    jenis_jamban_saniter                AS "jenisJambanSaniter",
    diagnosis_odgj                      AS "diagnosisOdgj",
    minum_obat_odgj_teratur             AS "minumObatOdgjTeratur",
    ada_art_dipasung                    AS "adaArtDipasung",
    perilaku_bab_dijamban               AS "perilakuBabDijamban",
    perilaku_penggunaan_air_bersih      AS "perilakuPenggunaanAirBersih",
    diagnosis_tb_paru                   AS "diagnosisTbParu",
    minum_obat_tb_teratur               AS "minumObatTbTeratur",
    batuk_berdahak_lebih_dari_2_minggu AS "batukBerdahakLebihDari2Minggu",
    diagnosis_hipertensi                AS "diagnosisHipertensi",
    pengkuran_tekanan_darah             AS "pengkuranTekananDarah",
    minum_obat_hipertensi_teratur       AS "minumObatHipertensiTeratur",
    sistolik                            AS "sistolik",
    diastolik                           AS "diastolik",
    pakai_kb                            AS "pakaiKb",
    ket_kb                              AS "ketKb",
    persalinan_di_faskes                AS "persalinanDiFaskes",
    asi_eksklusif                       AS "asiEksklusif",
    imunisasi_lengkap                   AS "imunisasiLengkap"
`

/**
 * Riwayat kesehatan keluarga dari `riwayat_ks_import` untuk satu NIK, diambil
 * lewat `raw_id` baris import yang NIK-nya sama.
 *
 * Kalau baris import tidak ada, hasilnya objek kosong; kalau baris import ada
 * tapi tidak punya baris riwayat, kolomnya `null` karena `LEFT JOIN`. Tidak
 * ditebak dari kolom lain.
 */
/**
 * Riwayat kesehatan keluarga untuk satu warga, dicari lewat `raw_id`.
 *
 * Berbeda dari {@link queryRiwayatKsUntukNik} yang memakai NIK, versi ini memakai
 * kunci yang sebenarnya: `raw_id` di `riwayat_ks_import` adalah foreign key ke
 * `data_warga_import.raw_id` (`src/lib/schema/data-import.ts:66-71`), relasinya
 * 1:1. NIK hanya dipakai sebagai cadangan ketika warga tidak punya `raw_id`
 * (warga hasil kunjungan sebelumnya tidak pernah menyimpan kunci itu).
 *
 * `ada` membedakan "tidak punya baris riwayat" dari "punya baris tapi semua
 * kolomnya `null"`. Tanpa itu, pemanggil tidak bisa tahu apakah kosong berarti
 * tidak ada data atau memang tidak diperiksa, dan dua kasus itu butuh perlakuan
 * berbeda.
 */
export async function queryRiwayatKsUntukWarga(kunci: {
  rawId: string
  nik: string
}): Promise<{ ada: boolean; nilai: RiwayatSasaran }> {
  const rawId = kunci.rawId.trim()
  const nik = kunci.nik.trim()
  if (!rawId && !nik) return { ada: false, nilai: {} }

  const syarat = rawId
    ? sql`riwayat_ks_import.raw_id = ${rawId}`
    : sql`data_warga_import.nik = ${nik} OR data_warga_import.raw_id = ${nik}`

  const rows = await db.execute(sql`
        SELECT true AS "ada", ${SELECT_RIWAYAT_KS}
        FROM riwayat_ks_import
        LEFT JOIN data_warga_import ON data_warga_import.raw_id = riwayat_ks_import.raw_id
        WHERE ${syarat}
        LIMIT 1
    `)
  const [row] = rows as unknown as Array<{ ada: boolean } & RiwayatSasaran>
  if (!row) return { ada: false, nilai: {} }
  const { ada, ...nilai } = row
  return { ada: true, nilai }
}

export async function queryRiwayatKsUntukNik(
  nik: string,
): Promise<RiwayatSasaran> {
  const rows = await db.execute(sql`
        SELECT ${SELECT_RIWAYAT_KS}
        FROM data_warga_import
        LEFT JOIN riwayat_ks_import ON riwayat_ks_import.raw_id = data_warga_import.raw_id
        WHERE data_warga_import.nik = ${nik}
           OR data_warga_import.raw_id = ${nik}
           OR lpad(regexp_replace(data_warga_import.raw_id, '[^0-9]', '', 'g'), 16, '0') = ${nik}
        ORDER BY data_warga_import.raw_id
        LIMIT 1
    `)
  const [row] = rows as unknown as RiwayatSasaran[]
  return row ?? {}
}

export async function querySurveyStatsByNik(): Promise<
  Array<{ nik: string; total: number; terakhir: string | null }>
> {
  // Kolom NIK di `surveys` bernama `wargaNik` (dulu `nik`, sudah di-rename saat
  // tabel dibuat ulang ke schema v2). Nama lama di sini bikin query gagal runtime
  // dengan "column nik does not exist", bukan error TypeScript.
  const rows = await db.execute(sql`
        WITH kunjungan AS (
          SELECT s."wargaNik" AS nik, s."tanggal"
          FROM surveys s
          WHERE s."wargaNik" IS NOT NULL
          UNION
          SELECT anggota->>'nik' AS nik, s."tanggal"
          FROM surveys s
          JOIN survey_entries e ON e."surveyId" = s.id
          JOIN form_versions fv ON fv.id = s."formVersionId"
          CROSS JOIN LATERAL jsonb_array_elements(fv."schema"->'sections') section
          CROSS JOIN LATERAL jsonb_array_elements(section->'fields') field
          CROSS JOIN LATERAL jsonb_array_elements(
            CASE WHEN jsonb_typeof(e.value->'anggota') = 'array'
              THEN e.value->'anggota' ELSE '[]'::jsonb END
          ) anggota
          WHERE field->>'id' = e."fieldId"::text
            AND field->>'name' = 'penyimpanan::record_legacy'
            AND anggota->>'nik' ~ '^[0-9]{16}$'
        )
        SELECT nik, COUNT(*)::int AS total, MAX("tanggal")::text AS terakhir
        FROM kunjungan
        GROUP BY nik
    `)
  return rows as unknown as Array<{
    nik: string
    total: number
    terakhir: string | null
  }>
}
