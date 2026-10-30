import { createMiddleware, createServerFn } from '@tanstack/react-start'
import { getCookie } from '@tanstack/react-start/server'
import type { HasilPin } from '@/lib/auth/pin-attempt'
import {
  destroySession,
  isValidPin,
  touchSession,
} from '@/lib/auth/session.server'
import {
  getKunjunganRumahRecord,
  getKunjunganRumahTemplateRows,
  listKunjunganRumahRecords,
  removeKunjunganRumahRecord,
  saveKunjunganRumahRecord,
  updateKunjunganRumahRecord,
} from '@/lib/server/kunjungan-rumah.server'
import { muatAturanForm } from '@/lib/server/form-builder/runtime-extend.server'
import {
  querySurveyors,
  listFasKes,
  listKaderAktif,
  listPengguna,
  listPetugasOpsi,
  simpanPengguna,
  setPenggunaAktif,
} from '@/lib/server/petugas/user-registry.server'
import {
  queryAnggotaKeluarga,
  queryRiwayatKsUntukWarga,
  querySasaranByNik,
  querySasaranListPaged,
  querySasaranWarga,
  querySurveyStatsByNik,
  queryWargaList,
  queryRiwayatKsUntukNik,
} from '@/lib/server/sasaran.server'
import {
  queryFormAdaSubmit,
  queryJawabanSubmit,
  queryRiwayatSubmit,
  queryRingkasanSubmit,
  querySurveysWithWarga,
} from '@/lib/server/submit.server'
import type {
  BarisIsianForm,
  BarisJawabanSubmit,
  BarisRiwayatSubmit,
} from '@/lib/server/submit.server'
import type {
  BarisWargaGabungan,
  RiwayatSasaran,
} from '@/lib/server/sasaran.server'
import { simpanPushSubscription } from '@/lib/server/notifikasi/push.server'
import type { NotifikasiData } from '@/lib/notifikasi/types'
import { ambilNotifikasiData } from '@/lib/server/notifikasi/data.server'
import { kelurahanStatDari } from '@/lib/server/dashboard.server'
import type { KelurahanStat } from '@/lib/server/dashboard.server'
import {
  listKegiatan as listKegiatanV2,
  simpanKegiatan,
} from '@/lib/server/survey/kegiatan.server'
import {
  buatFormBaru,
  daftarVersiForm,
  hapusForm,
  listFormBaru,
  ringkasanHapusForm,
} from '@/lib/server/form-builder/form.server'
import { ambilDefinisiVersi } from '@/lib/server/form-builder/section.server'
import { buildFormVersion } from '@/lib/server/form-builder/build.server'
import type {
  BuildFormVersionInput,
  BuildFormVersionResult,
} from '@/components/kelola/builder/types'
import {
  buatDraftBerikutnya,
  hapusDraftVersiForm,
  ringkasanHapusDraftVersiForm,
  terbitkanVersiForm,
} from '@/lib/server/form-builder/form-version.server'
import {
  ambilFormulirUntukIsi,
  daftarFormulirTerisi,
  simpanFormulir as simpanFormulirRuntime,
} from '@/lib/server/survey/form-runtime.server'
import type { SimpanFormulirInput } from '@/lib/server/survey/form-runtime.server'
import { KODE_FORM_BAWAAN } from '@/lib/constants'
import {
  SEMUA_TIPE_FIELD,
  TIPE_BUTUH_OPSI,
} from '@/lib/service/form-builder/validasi'
import type { MonthlyKegiatanStat } from '@/hooks/dashboard/use-kegiatan-trend'
import { db } from '../server/db.server'
import { surveyEntries } from '../schema/schema'

const namaBulan = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
]

/* ALUR LOGIN
1. cek sessionToken pake beforeLoad di /laporan (form)
2. sessionToken di crosscheck ke validSessions di DB
3. kalo gk ada kredensial redirect ke pin
4. pin valid redirect ke /laporan
5. update expireTime sessionToken kalo akses /laporan
*/

// ganti method GET → POST — expect: login tak bisa dipicu lewat link/GET
export const pinLogin = createServerFn({ method: 'POST' })
  .validator((data: { pin: string }) => data)
  .handler(async ({ data }): Promise<HasilPin> => {
    // Selalu menolak: bentuk hasil hanya membedakan "terkunci" dari
    // "PIN salah" supaya halaman login bisa memberi tahu sisa waktu.
    return await isValidPin(data.pin)
  })

export const getSessionToken = createServerFn({ method: 'GET' }).handler(
  async () => {
    const sessionToken = getCookie('session')
    if (!sessionToken) throw new Error('Unauthorized') // gak pernah login
    return await touchSession(sessionToken)
  },
)

export const logoutSession = createServerFn({ method: 'POST' }).handler(
  async () => {
    await destroySession(getCookie('session'))
  },
)

//   crosscheck sessionToken ke valid_session ? beres; token bajakan/ kedaluwarsa ditolak.
export const authSessionToken = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const sessionToken = getCookie('session')
    if (!sessionToken) throw new Error('Unauthorized')
    const session = await touchSession(sessionToken)
    return next({ context: { sessionToken, profile: session.profile } })
  },
)

// [perbaikan] daftar petugas lewat server fn terproteksi middleware — expect: opsi dropdown
//   datang dari DB, klien tanpa sesi valid ditolak sebelum data keluar.
export const listSurveyors = createServerFn({ method: 'GET' })
  .middleware([authSessionToken])
  .handler(async () => {
    return await querySurveyors()
  })

// ---- read model DB untuk UI (pengganti data dummy) ----
export interface SasaranListRow {
  rawId: string
  nik: string
  nikValid: boolean
  needsUpdate: boolean
  nama: string
  kelurahan: string
  status: 'Sudah' | 'Belum'
  tgl: string | null
  kunjunganRumah: number
}

export interface SasaranListResult {
  rows: SasaranListRow[]
  total: number
}

/**
 * Baris isian form untuk dashboard dan laporan.
 *
 * `nik` boleh null: form yang tidak menunjuk warga per-submission (kegiatan, form
 * generic dari Form Builder) tetap punya record sendiri. `formNama` ikut
 * dibawa supaya tabel bisa melabeli baris sesuai form asalnya — `surveys` tidak
 * punya kolom penanda form, jadi nama diambil dari join `form_versions → forms`.
 */
export interface SurveyRow {
  id: string
  tanggal: string
  nik: string | null
  nama: string
  kelurahan: string
  petugas: string
  formNama: string
  formKode: string | null
  formVersion: number
}

export interface DashboardData {
  totals: { warga: number; dikunjungi: number; kunjunganRumah: number }
  kelurahan: KelurahanStat[]
  recent: SurveyRow[]
}

// Halaman /sasaran memakai sumber gabungan (`data_warga` + `data_warga_import`)
// supaya daftar tidak cuma berisi 1 baris. Filter dan paginasi diproses server
// (lihat `querySasaranListPaged`) — klien cukup kirim q/status/kel/page.
export const getSasaranList = createServerFn({ method: 'GET' })
  .middleware([authSessionToken])
  .validator(
    (data: {
      q?: string
      status?: string
      kel?: string
      page?: number
      all?: boolean
    }) => data,
  )
  .handler(async ({ data }): Promise<SasaranListResult> => {
    const q = data.q ?? ''
    const status = (data.status ?? 'all') as 'all' | 'Sudah' | 'Belum'
    const result = await querySasaranListPaged({
      q,
      status,
      kel: data.kel ?? 'all',
      page: data.page ?? 1,
      pageSize: 10,
      all: data.all ?? false,
    })
    const stats = await querySurveyStatsByNik()
    const byNik = new Map(stats.map((s) => [s.nik, s]))
    const rows: SasaranListRow[] = result.rows.map((w) => {
      // NIK tampil bisa berupa NIK sementara (derive raw_id) yang bukan
      // NIK asli di `surveys`; `wargaNik` hanya terisi NIK asli. Jadi
      // statistik dicocokkan lewat `nik` hasil derive — baris sementara
      // tidak akan pernah ketemu, dan itu memang benar (belum dikunjungi).
      const st = byNik.get(w.nik)
      return {
        rawId: w.rawId,
        nik: w.nik,
        nikValid: w.nikValid,
        needsUpdate: w.needsUpdate,
        nama: w.nama_art,
        kelurahan: w.kelurahan,
        status: st ? 'Sudah' : 'Belum',
        tgl: st?.terakhir ?? null,
        kunjunganRumah: st?.total ?? 0,
      }
    })
    return { rows, total: result.total }
  })

/** Baris warga di halaman detail: bentuk gabungan + kolom riwayat KS yang
 *  ditambahkan opsional. Yang tidak ada di `riwayat_ks_import` tetap `null`. */
export type SasaranDetailRow = BarisWargaGabungan & RiwayatSasaran

export const getSasaranDetail = createServerFn({ method: 'GET' })
  .middleware([authSessionToken])
  .validator((data: { nik: string }) => data)
  .handler(
    async ({
      data,
    }): Promise<{ warga: SasaranDetailRow | null; surveys: SurveyRow[] }> => {
      const [warga, surveys] = await Promise.all([
        querySasaranByNik(data.nik),
        querySurveysWithWarga(500),
      ])
      // NIK yang hanya ada di `data_warga_import` juga ketemu di sini, jadi
      // detail menampilkan data awal import dan tidak lagi "tidak ditemukan"
      // — pencariannya per NIK (bukan scan daftar penuh seperti sebelumnya).
      const found = warga
      if (!found) return { warga: null, surveys: [] as SurveyRow[] }
      const riwayat = await queryRiwayatKsUntukNik(
        found.rawId ? found.rawId : data.nik,
      )
      return {
        warga: { ...found, ...riwayat },
        surveys: surveys.filter(
          (s) => s.nik === found.nik || s.nik === data.nik,
        ),
      }
    },
  )

export const getDashboardData = createServerFn({ method: 'GET' })
  .middleware([authSessionToken])
  .handler(async (): Promise<DashboardData> => {
    const [warga, stats, recent] = await Promise.all([
      queryWargaList(),
      querySurveyStatsByNik(),
      querySurveysWithWarga(50),
    ])
    const visited = new Set(stats.map((s) => s.nik))
    const kelurahan = kelurahanStatDari(warga, stats)
    return {
      totals: {
        warga: warga.length,
        dikunjungi: visited.size,
        kunjunganRumah: stats.reduce((a, s) => a + s.total, 0),
      },
      kelurahan,
      recent,
    }
  })

export const getLaporanKunjunganRumah = createServerFn({ method: 'GET' })
  .middleware([authSessionToken])
  .handler(async (): Promise<SurveyRow[]> => {
    return await querySurveysWithWarga(500)
  })

/**
 * Notifikasi di dalam website (pengganti pesan WhatsApp).
 *
 * Yang dikirim hanya SUMBER data, bukan `Warning` yang sudah jadi. `buildWarnings`
 * adalah fungsi murni dan jalan di browser juga, jadi filter wilayah di dropdown
 * lonceng dan di halaman /notifikasi cukup memanggilnya ulang — tidak ada query
 * kedua, dan angka yang tampil di lonceng dijamin sama dengan yang tampil di
 * dashboard karena keduanya memanggil builder yang sama.
 *
 * Sumber jadwal & tindak lanjut diambil dari payload `record_legacy` (lihat
 * `lib/notifikasi/sumber-warning.ts`). Builder di `lib/dashboard/
 * warning.ts` sudah punya dua slot itu sejak awal tapi tidak pernah diisi —
 * mengisinya di sini membuat `jadwal_terlambat` dan `tindak_lanjut_belum_selesai`
 * benar-benar bisa muncul, bukan kode mati.
 *
 * Record kunjungan sengaja dipisah dari cakupan: `listKunjunganRumahRecords()`
 * menyentuh `survey_entries`, sedangkan cakupan hanya butuh `data_warga` +
 * `surveys`. Kalau satu gagal, warning cakupan tetap tampil dan hanya jadwal serta
 * tindak lanjut yang kosong — lonceng tidak boleh membuat seluruh halaman error.
 */
export const getNotifikasiData = createServerFn({ method: 'GET' })
  .middleware([authSessionToken])
  // Query-nya di `data.server.ts`, dipakai bersama cron. Catatan di atas tetap
  // berlaku: duplikasi query di dua tempat membuat lonceng dan push bisa beda
  // angka, jadi sumbernya harus satu.
  .handler(async (): Promise<NotifikasiData> => ambilNotifikasiData())

export const simpanPushSubscriptionFn = createServerFn({ method: 'POST' })
  .middleware([authSessionToken])
  .validator(
    (d: {
      endpoint: string
      keys: { p256dh: string; auth: string }
      userAgent?: string
    }) => d,
  )
  .handler(async ({ data }) => {
    await simpanPushSubscription(data)
    return { ok: true }
  })

// ---- riwayat submit semua form ----
// Dipisah dari laporan kunjungan: di sini yang penting form mana, bukan cakupan
// warga. Record form buatan Form Builder tidak punya kolom penanda di `surveys`,
// jadi identitasnya selalu dibaca lewat join ke `forms` dan ditampilkan apa adanya.

export const getRiwayatSubmit = createServerFn({ method: 'GET' })
  .middleware([authSessionToken])
  .validator((data: { formId?: number | null; limit?: number }) => data)
  .handler(
    async ({ data }): Promise<BarisRiwayatSubmit[]> =>
      await queryRiwayatSubmit({
        formId: data.formId ?? null,
        limit: data.limit ?? 200,
      }),
  )

/** Daftar form yang punya submission, untuk dropdown filter riwayat. */
export const getFormAdaSubmit = createServerFn({ method: 'GET' })
  .middleware([authSessionToken])
  .handler(
    async (): Promise<
      Array<{ formId: number; nama: string; jumlahSubmit: number }>
    > => await queryFormAdaSubmit(),
  )

export const getDetailSubmit = createServerFn({ method: 'GET' })
  .middleware([authSessionToken])
  .validator((data: { surveyId: string }) => data)
  .handler(
    async ({
      data,
    }): Promise<{
      answers: BarisJawabanSubmit[]
      row: BarisIsianForm | null
    }> => {
      const answers = await queryJawabanSubmit(data.surveyId)
      return { answers, row: await queryRingkasanSubmit(data.surveyId) }
    },
  )

// ---- kunjungan rumah — CRUD langsung ke DB, tanpa localStorage ----
// Definisi form (section + question + opsi select) dibaca dari DB. Dipisah dari record
// karena bentuknya berbeda: yang ini bisa berubah tiap admin menyunting form, yang
// record tidak boleh ikut berubah bentuk.
export const getKunjunganRumahTemplate = createServerFn({ method: 'GET' })
  .middleware([authSessionToken])
  .handler(async () => {
    const rows = await getKunjunganRumahTemplateRows()
    if (!rows) return null
    const aturan = await muatAturanForm(rows.formVersionId)
    return { ...rows, aturan }
  })

export const listKunjunganRumah = createServerFn({ method: 'GET' })
  .middleware([authSessionToken])
  .handler(async () => await listKunjunganRumahRecords())

/** Suggestion warga sasaran untuk form Kunjungan Rumah, dibaca dari
 *  `data_warga_import`. Dipakai saat user mengetik NIK atau nama KK; hasilnya
 *  hanya mengisi form, tidak menyentuh `data_warga` — insert ke sana tetap
 *  terjadi saat user menekan Simpan. */
export const cariSasaranWarga = createServerFn({ method: 'POST' })
  .middleware([authSessionToken])
  .validator((data: { q: string }) => data)
  .handler(async ({ data }) => await querySasaranWarga(data.q))

/**
 * Semua warga satu keluarga untuk mengisi tabel anggota.
 *
 * Dipanggil setelah suggestion dipilih: form hanya dapat satu warga, padahal
 * yang perlu didaftarkan seluruh anggota household-nya. NIK ikut dikirim di
 * samping nama KK supaya dua keluarga dengan nama KK sama masih bisa dibedakan.
 */
/**
 * Riwayat kesehatan keluarga untuk mengisi isian awal section Sanitasi.
 *
 * Berbeda dari `getSasaranDetail` yang join ke `data_warga` untuk halaman detail
 * sasaran, ini murni untuk form: dipanggil sekali saat suggestion dipilih, lalu
 * dipakai sebagai isian awal dan tidak disimpan.
 */
export const cariRiwayatKs = createServerFn({ method: 'POST' })
  .middleware([authSessionToken])
  .validator((data: { rawId: string; nik: string }) => data)
  .handler(async ({ data }) => await queryRiwayatKsUntukWarga(data))

export const cariAnggotaKeluarga = createServerFn({ method: 'POST' })
  .middleware([authSessionToken])
  .validator(
    (data: {
      namaKk: string
      nik: string
      kelurahan?: string | null
      kecamatan?: string | null
      rt?: string | null
      rw?: string | null
      jumlahArt?: number | null
    }) => data,
  )
  .handler(async ({ data }) => await queryAnggotaKeluarga(data))

export const getKunjunganRumah = createServerFn({ method: 'GET' })
  .middleware([authSessionToken])
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => await getKunjunganRumahRecord(data.id))

export const saveKunjunganRumah = createServerFn({ method: 'POST' })
  .middleware([authSessionToken])
  .validator((data: { record: Record<string, unknown> }) => data)
  .handler(async ({ data }) => await saveKunjunganRumahRecord(data.record))

export const updateKunjunganRumah = createServerFn({ method: 'POST' })
  .middleware([authSessionToken])
  .validator((data: { id: string; record: Record<string, unknown> }) => data)
  .handler(
    async ({ data }) => await updateKunjunganRumahRecord(data.id, data.record),
  )

export const removeKunjunganRumah = createServerFn({ method: 'POST' })
  .middleware([authSessionToken])
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    await removeKunjunganRumahRecord(data.id)
  })

// ---- kegiatan pemberdayaan — generic submission v2 ----
// formerly ditulis ke tabel `kegiatan_records`, yang sudah dihapus dari database
// sehingga fitur ini mati saat runtime. Sekarang lewat `surveys` + `survey_entries`
// dengan `surveys.petugasId` menunjuk `users.id` hasil dropdown Petugas.
export const listKegiatan = createServerFn({ method: 'GET' })
  .middleware([authSessionToken])
  .handler(async () => await listKegiatanV2())

export const getKegiatanMonthlyStats = createServerFn({
  method: 'GET',
}).handler(async (): Promise<MonthlyKegiatanStat[]> => {
  // Ambil data JSONB dari database
  const rows = await db
    .select({
      value: surveyEntries.value,
    })
    .from(surveyEntries)

  const rekap = new Map<
    string,
    {
      totalKegiatan: number
      totalHadir: number
      totalPeserta: number
      byJenis: Map<string, number>
    }
  >()

  for (const row of rows) {
    const value = row.value as Record<string, any>

    // Sesuaikan dengan struktur JSONB value yang sebenarnya.
    const info = value.info

    const tanggal = info?.tglPengumpulan
    const jenis = info?.posyandu

    // Abaikan data yang tidak memiliki tanggal kegiatan.
    if (!tanggal) continue

    const date = new Date(tanggal)

    if (Number.isNaN(date.getTime())) continue

    const month = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
    ].join('-')

    if (!rekap.has(month)) {
      rekap.set(month, {
        totalKegiatan: 0,
        totalHadir: 0,
        totalPeserta: 0,
        byJenis: new Map(),
      })
    }

    const item = rekap.get(month)!

    // Satu baris survey_entries dianggap satu kegiatan.
    item.totalKegiatan += 1

    // TODO: Ganti dengan field kehadiran dan peserta yang sebenarnya.
    // Jangan menghitung keduanya dari jumlah baris jika struktur
    // JSONB tidak menyatakan bahwa satu baris = satu peserta hadir.

    if (jenis) {
      item.byJenis.set(jenis, (item.byJenis.get(jenis) ?? 0) + 1)
    }
  }

  return Array.from(rekap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, item]) => ({
      month,
      label: namaBulan[Number(month.slice(5, 7)) - 1] ?? 'Tidak Diketahui',
      totalKegiatan: item.totalKegiatan,
      totalHadir: item.totalHadir,
      totalPeserta: item.totalPeserta,
      pctHadir:
        item.totalPeserta > 0
          ? Math.round((item.totalHadir / item.totalPeserta) * 100)
          : 0,
      byJenis: Array.from(item.byJenis.entries()).map(([jenis, count]) => ({
        jenis,
        count,
      })),
    }))
})

export const saveKegiatan = createServerFn({ method: 'POST' })
  .middleware([authSessionToken])
  .validator((data: { record: Record<string, unknown> }) => data)
  .handler(async ({ data }) => await simpanKegiatan(data.record))

// ---- registry kader (pengganti master admin /kelola) ----
// Penulisan hanya bisa dari /kelola, yang route-nya dilindungi `requireAuth`.
//
// CATATAN: di sistem ini tidak ada penjaga akses berbasis peran sama sekali.
// Satu PIN global, satu profil sesi konstan, jadi siapa pun yang punya sesi
// valid sudah setara dengan admin (lihat catatan di `src/lib/auth/auth.ts`).
// Yang divalidasi di sini murni data: fasilitas yang dipilih harus benar-benar
// ada, dan kader yang dipilih harus aktif.
export const listUserRegistry = createServerFn({ method: 'GET' })
  .middleware([authSessionToken])
  .handler(async () => await listPengguna())

export const listFasKesOpsi = createServerFn({ method: 'GET' })
  .middleware([authSessionToken])
  .handler(async () => await listFasKes())

export const saveUserRegistry = createServerFn({ method: 'POST' })
  .middleware([authSessionToken])
  .validator((data: { namaLama: string | null; row: unknown }) => data)
  .handler(async ({ data }) => await simpanPengguna(data.namaLama, data.row))

export const setUserRegistryAktif = createServerFn({ method: 'POST' })
  .middleware([authSessionToken])
  .validator((data: { nama: string; aktif: boolean }) => data)
  .handler(async ({ data }) => {
    await setPenggunaAktif(data.nama, data.aktif)
  })

/** Dipakai /kelola untuk mengisi dropdown kader, dan Form Kunjungan Rumah untuk petugas. */
export const listPetugasAktif = createServerFn({ method: 'GET' })
  .middleware([authSessionToken])
  .validator((data: { fasKesId?: number | null }) => data)
  .handler(async ({ data }) => await listPetugasOpsi(data.fasKesId ?? null))

/** Daftar kader aktif untuk filter Rekap Kunjungan Rumah. */
export const listKaderUntukRekap = createServerFn({ method: 'GET' })
  .middleware([authSessionToken])
  .validator((data: { fasKesId?: number | null }) => data)
  .handler(async ({ data }) => await listKaderAktif(data.fasKesId ?? null))

// ---- form builder (tab /kelola) ----
// Lapisan server function untuk editor form. Semua bentuk datanya milik modul
// form-builder, validator di sini hanya meneruskan supaya tidak ada bentuk kedua
// yang bisa berbeda dari yang dipakai validasi backend.
//
// `actorId` selalu null: login aplikasi memakai satu PIN global dan tidak ada
// pemetaan session -> `users.id` (lihat catatan autentikasi di
// src/lib/server/petugas/user-registry.server.ts), jadi petugas tidak bisa disimpulkan dari
// sesi. Audit tetap terekam karena `audit_logs.userId` nullable.
//
// `KesalahanValidasi` sengaja dibiarkan terlempar apa adanya supaya petugas
// melihat `pesan` yang sudah ditulis modul form-builder, bukan pesan generik.

export const listFormBuilder = createServerFn({ method: 'GET' })
  .middleware([authSessionToken])
  .handler(async () => await listFormBaru())

export const ambilEditorForm = createServerFn({ method: 'GET' })
  .middleware([authSessionToken])
  .validator((data: { formVersionId: string }) => data)
  .handler(async ({ data }) => await ambilDefinisiVersi(data.formVersionId))

export const daftarVersiBuilder = createServerFn({ method: 'GET' })
  .middleware([authSessionToken])
  .validator((data: { formId: number }) => data)
  .handler(async ({ data }) => await daftarVersiForm(data.formId))

/** Daftar tipe field untuk editor. Satu-satunya sumbernya `SEMUA_TIPE_FIELD` dan
 *  `TIPE_BUTUH_OPSI` di form-builder/lib/validasi.ts — backend yang menolak field tanpa
 *  opsi, jadi UI tidak boleh menyimpan salinannya sendiri karena cepat berbeda.
 *  Enum `form_field_type` tidak dibaca langsung: mengimpornya menarik drizzle
 *  pg-core ke bundle klien. */
export const daftarJenisField = createServerFn({ method: 'GET' })
  .middleware([authSessionToken])
  .handler(async () => ({
    semua: [...SEMUA_TIPE_FIELD],
    butuhOpsi: [...TIPE_BUTUH_OPSI],
  }))

export const buatFormBuilder = createServerFn({ method: 'POST' })
  .middleware([authSessionToken])
  .validator((data: { nama: string; deskripsi?: string }) => data)
  .handler(
    async ({ data }) =>
      await buatFormBaru({
        nama: data.nama,
        deskripsi: data.deskripsi,
        actorId: null,
      }),
  )

/** Versi published dibekukan, jadi perubahan struktur harus punya draft baru.
 *  `dariVersiId` hanya dipakai service untuk memastikan versi asal benar milik
 *  form ini; tidak diisi berarti pemanggil memang meminta versi berikutnya. */
export const buatDraftBuilder = createServerFn({ method: 'POST' })
  .middleware([authSessionToken])
  .validator((data: { formId: number; dariVersiId?: string }) => data)
  .handler(
    async ({ data }) =>
      await buatDraftBerikutnya(data.formId, { dariVersiId: data.dariVersiId }),
  )

export const terbitkanVersiBuilder = createServerFn({ method: 'POST' })
  .middleware([authSessionToken])
  .validator((data: { formVersionId: string }) => data)
  .handler(
    async ({ data }) =>
      await terbitkanVersiForm(data.formVersionId, { actorId: null }),
  )

/**
 * Isi satu versi draft, supaya dialog konfirmasi bisa menyebut jumlah section dan
 * field yang akan hilang. Server yang menghitungnya — angka dari klien bisa saja
 * kedaluwarsa di antara dialog dibuka dan tombol ditekan.
 */
export const ringkasanHapusDraftBuilder = createServerFn({ method: 'GET' })
  .middleware([authSessionToken])
  .validator((data: { formVersionId: string }) => data)
  .handler(
    async ({ data }) => await ringkasanHapusDraftVersiForm(data.formVersionId),
  )

/**
 * Hapus versi draft beserta struktur di dalamnya.
 *
 * Aturan main ada di `validasiHapusDraftVersi`: hanya versi `draft`, bukan draft
 * form bawaan, bukan draft yang sudah berisian, dan bukan versi satu-satunya.
 * Serverfn ini tidak menambahkan aturan sendiri — cukup meneruskan, supaya
 * satu tempat yang menegakkan aturan.
 */
export const hapusDraftBuilder = createServerFn({ method: 'POST' })
  .middleware([authSessionToken])
  .validator((data: { formVersionId: string }) => data)
  .handler(
    async ({ data }) =>
      await hapusDraftVersiForm(data.formVersionId, { actorId: null }),
  )

/**
 * Ringkasan isi form (versi, submit, jawaban, warga, tanggal terakhir).
 *
 * Dipanggil sebelum dialog hapus dibuka supaya admin melihat angka yang akan
 * hilang, bukan sekadar konfirmasi buta. Server yang menghitungnya — angka
 * dari klien bisa saja kedaluwarsa di antara dialog dibuka dan tombol ditekan.
 */
export const ringkasanHapusFormBuilder = createServerFn({ method: 'GET' })
  .middleware([authSessionToken])
  .validator((data: { formId: number }) => data)
  .handler(async ({ data }) => await ringkasanHapusForm(data.formId))

/**
 * Hapus form. `hapusPermanent` + `konfirmasiNama` hanya perlu diisi kalau form
 * sudah punya isian: tanpa itu server menolak dengan `FORM_PUNYA_ISIAN` dan
 * pesan yang menyebutkan berapa banyak data yang akan hilang.
 */
export const hapusFormBuilder = createServerFn({ method: 'POST' })
  .middleware([authSessionToken])
  .validator(
    (data: {
      formId: number
      hapusPermanent?: boolean
      konfirmasiNama?: string | null
    }) => data,
  )
  .handler(
    async ({ data }) =>
      await hapusForm({
        formId: data.formId,
        hapusPermanent: data.hapusPermanent,
        konfirmasiNama: data.konfirmasiNama ?? null,
        actorId: null,
      }),
  )

export const buildFormBuilder = createServerFn({ method: 'POST' })
  .middleware([authSessionToken])
  .validator((data: BuildFormVersionInput) => data)
  .handler(async ({ data }): Promise<BuildFormVersionResult> => {
    return await buildFormVersion(data)
  })

// ---- runtime form generik (isi form dari definisi yang tayang) ----
// Lawanan dari Form Builder di atas: Builder memegang definisi form (forms,
// form_versions, form_sections, form_fields, form_field_options) dan satu-satunya
// yang boleh menulisnya, sedangkan runtime hanya MEMBACA definisi itu dan
// menulis ke `surveys` + `survey_entries`. Pemisahan ini yang membuat "define +
// publish" benar-benar terpisah dari "read published + fill": menyunting form
// tidak mungkin mengubah apa yang sedang diisi petugas, karena yang tayang
// adalah versi `published` yang tidak bisa diedit.
//
// Tidak ada nama form, `forms.kode`, atau `nama` field yang ditulis di sini.
// Semua yang tampil dan semua yang divalidasi berasal dari database, diambil
// lewat id atau status, supaya form baru yang dibuat admin langsung bisa diisi
// tanpa perubahan kode.
//
// `actorId` selalu null, sama seperti section builder di atas: login memakai satu
// PIN global dan tidak ada pemetaan session -> `users.id`. Pencatat yang sebenarnya
// ada di `surveys.petugasId`, jadi isian tetap punya pelaku.
//
// `KesalahanValidasi` dibiarkan terlempar apa adanya supaya petugas melihat
// `pesan` yang sudah ditulis modul form-builder — termasuk daftar field wajib yang kosong
// sekaligus, bukan satu per permintaan.

export const listFormulir = createServerFn({ method: 'GET' })
  .middleware([authSessionToken])
  .handler(async () => await daftarFormulirTerisi())

export const listFormulirForNav = createServerFn({ method: 'GET' })
  .middleware([authSessionToken])
  .handler(async () => {
    const all = await daftarFormulirTerisi()
    return all.filter((f) => f.kode !== KODE_FORM_BAWAAN.kunjunganRumah)
  })

export const ambilFormulir = createServerFn({ method: 'GET' })
  .middleware([authSessionToken])
  .validator((data: { formVersionId: string }) => data)
  .handler(async ({ data }) => await ambilFormulirUntukIsi(data.formVersionId))

export const simpanFormulir = createServerFn({ method: 'POST' })
  .middleware([authSessionToken])
  .validator((data: Omit<SimpanFormulirInput, 'actorId'>) => data)
  .handler(
    async ({ data }) => await simpanFormulirRuntime({ ...data, actorId: null }),
  )
