import {
  check,
  date,
  index,
  integer,
  pgTable,
  text,
  varchar,
  boolean,
  timestamp,
  uuid,
  jsonb,
  unique,
  uniqueIndex,
  smallint,
} from 'drizzle-orm/pg-core'

import { sql } from 'drizzle-orm'
import {
  hubunganKeluargaEnum,
  jenisKelaminEnum,
  statusKawinEnum,
  agama,
  pekerjaan,
  pendidikanEnum,
  fasKes,
  auditAction,
} from './type-enum'
import type { FormDefinition } from '@/lib/form-builder/form-schema'

// WAJIB `withTimezone: true` di setiap kolom timestamp. Jangan dikembalikan jadi
// `timestamp()` polos.
//
// Alasannya nyata, bukan teori: driver `postgres` v3 membaca `timestamp without
// time zone` sebagai waktu LOKAL, sedangkan nilainya ditulis sebagai UTC
// (`now()` dengan `TimeZone = UTC`). Di Asia/Jakarta hasilnya bergeser 7 jam:
// `'2026-10-04 07:41:52'::timestamp` terbaca `2026-10-04T00:41:52Z`. Uji nyata
// lewat driver yang dipakai app, bukan asumsi.
//
// Kolom `date` (surveys.tanggal, data_warga.tgl_lahir) TIDAK ikut aturan ini:
// tanggal kalender memang tidak punya zona waktu.
//
// Semua tabel memakai `pgTable.withRLS`, supaya role `anon` dan `authenticated`
// (jalur PostgREST Supabase) ditolak. Tidak ada policy permissive di mana pun, dan
// tanpa itu Postgres menolak semua akses baris. Server tidak lewat jalur itu: ia
// terhubung langsung lewat DATABASE_URL sebagai pemilik tabel, dan pemilik melewati
// RLS. Tambahkan policy hanya kalau ada klien Supabase yang memang perlu membaca
// tabel tertentu. Dua tabel impor punya policy RESTRICTIVE di `data-import.ts`;
// policy itu tidak memberi akses, hanya menambah syarat.

export const dataWargaTable = pgTable.withRLS('data_warga', {
  nik: varchar({ length: 16 }).notNull().primaryKey(),
  nama_art: varchar({ length: 255 }).notNull(),
  nama_kk: varchar({ length: 255 }).notNull(),
  hubungan_keluarga: hubunganKeluargaEnum().notNull(),
  alamat: text().notNull(),
  tgl_lahir: date().notNull(),
  rt: varchar({ length: 3 }).notNull(),
  rw: varchar({ length: 3 }).notNull(),
  kecamatan: text().notNull(),
  kelurahan: text().notNull(),
  kota: text().notNull(),
  status_kawin: statusKawinEnum().notNull(),
  staff: uuid()
    .notNull()
    .references(() => users.id),
  jenis_kelamin: jenisKelaminEnum().notNull(),
  wanita_usia_hamil: boolean().notNull(),
  agama: agama().notNull(),
  pendidikan: pendidikanEnum().notNull(),
  pekerjaan: pekerjaan().notNull(),
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
})

export const wilayahKerja = pgTable.withRLS(
  'wilayah_kerja',
  {
    id: smallint().primaryKey().notNull().generatedAlwaysAsIdentity(),
    kecamatan: text().notNull(),
    kelurahan: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('wilayah_kerja_kecamatan_kelurahan').on(
      t.kecamatan,
      t.kelurahan,
    ),
  ],
)

export const fasilitasKesehatan = pgTable.withRLS(
  'fasilitas_kesehatan',
  {
    id: smallint().primaryKey().notNull().generatedAlwaysAsIdentity(),
    wilayahKerjaId: smallint()
      .notNull()
      .references(() => wilayahKerja.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    fasKesType: fasKes().notNull(), // Posyandu | Pustu
    nama: varchar({ length: 20 }).notNull(),
    alamat: text().notNull(),
    rt: varchar({ length: 3 }),
    rw: varchar({ length: 3 }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    // Menampilkan daftar fasilitas per wilayah kerja, jadi index ini sudah ada di
    // database dan ikut dicatat di sini agar tidak dianggap index asing.
    index('fasilitas_kesehatan_wilayah_kerja_id_idx').on(t.wilayahKerjaId),
  ],
)

/**
 * Daftar kader — bukan tabel akun.
 *
 * Dulunya tabel ini punya kolom `role` (enum 'admin'/'kader') dan `pinHash`.
 * Keduanya dihapus: login memakai satu PIN global dari environment
 * (`isValidPin` di `src/lib/auth/session.server.ts`), jadi tidak ada hash per-akun yang
 * perlu diverifikasi, dan `role` tidak pernah membatasi apa pun — semua sesi
 * valid setara (lihat `src/lib/auth/auth.ts`). Yang tersisa adalah data referensi:
 * siapa saja yang boleh dipilih sebagai petugas pencatat.
 *
 * `pinHash` dihapus, bukan dibiarkan terisi penanda. Kolom itu tidak pernah
 * dibaca, dan kolom yang terlihat seperti kredensial tapi tidak pernah dipakai
 * hanya menimbulkan pertanyaan "ini kredensial atau bukan" bagi siapa pun yang
 * nanti membaca basis data.
 */
export const users = pgTable.withRLS(
  'users',
  {
    id: uuid().primaryKey().defaultRandom(),
    // RESTRICT, bukan CASCADE: menghapus fasilitas tidak boleh ikut menghapus akun
    // petugas. Akun petugas adalah audit trail (lihat audit_logs.userId), jadi harus
    // bertahan walau fasilitasnya dihapus.
    fasKesId: smallint()
      .notNull()
      .references(() => fasilitasKesehatan.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    nama: varchar({ length: 255 }).notNull(),
    phone: varchar({ length: 20 }),
    aktif: boolean().notNull().default(true),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    // Login selalu menyaring lewat fasKesId untuk membatasi petugas ke fasilitas
    // nya sendiri. Index ini sudah ada di database, cuma belum dicatat di sini.
    index('users_fas_kes_id_idx').on(t.fasKesId),
  ],
)

// tabel untuk pilihan form, sehingga user bisa membuat atau menghapus form
export const forms = pgTable.withRLS(
  'forms',
  {
    id: smallint().primaryKey().notNull().generatedAlwaysAsIdentity(),
    nama: varchar({ length: 100 }).notNull().unique(), // form default saat ini ada Form Kunjungan Rumah | Form Kegiatan Pemberdayaan
    // Kode stabil untuk seeding idempotent (KEGIATAN_PEMBERDAYAAN,
    // CHECKLIST_KUNJUNGAN_RUMAH). Dipisah dari `nama` karena `nama` boleh
    // diubah admin, sedangkan seeder harus menemukan form yang sama lewat
    // kunci yang tidak ikut berubah. NULL untuk form yang dibuat manual di
    // editor, jadi form bawaan dan form buatan user tidak tertukar.
    kode: varchar({ length: 50 }),
    // Apakah setiap submission form ini wajib menunjuk satu warga di
    // `surveys.wargaNik`. False untuk Form Kegiatan Pemberdayaan, yang
    // memang tidak punya warga tetap per-submission (daftar pesertanya
    // disimpan di dalam field, bukan di header). Aturan lintas tabel ini
    // tidak bisa ditegakkan CHECK di database, jadi dijaga di backend saat
    // insert survey.
    subjekWargaWajib: boolean().notNull().default(true),
    deskripsi: text(), // deskripsi form
    aktif: boolean().notNull().default(true), // tampilkan form atau tidak, agar user bisa menonaktifkan form sementara sebelum hapus total
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('forms_kode_key').on(t.kode)],
)

export const formVersions = pgTable.withRLS(
  'form_versions',
  {
    id: uuid().primaryKey().defaultRandom(),
    formId: smallint()
      .notNull()
      .references(() => forms.id, { onDelete: 'cascade' }),
    version: integer().notNull(),
    schema: jsonb('schema').$type<FormDefinition>().notNull(),
    status: varchar({ length: 20 }).notNull().default('draft'),
    publishedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('form_versions_form_id_version').on(t.formId, t.version),
    index('form_versions_form_id_status_idx').on(t.formId, t.status),
    check(
      'form_versions_status_check',
      sql`((status)::text = ANY ((ARRAY['draft'::character varying, 'published'::character varying, 'archived'::character varying])::text[]))`,
    ),
    check('form_versions_version_check', sql`(version >= 1)`),
    // Versi published wajib punya publishedAt, kalau tidak rekap "ber kapan form ini
    // tayang" jadi tidak bisa dijawab.
    check(
      'form_versions_published_at_check',
      sql`(((status)::text <> 'published'::text) OR ("publishedAt" IS NOT NULL))`,
    ),
  ],
)

// tabel hasil dan riwayat survey
export const surveys = pgTable.withRLS(
  'surveys',
  {
    id: uuid().primaryKey().defaultRandom(),
    formVersionId: uuid()
      .notNull()
      .references(() => formVersions.id), // penanda terhubung dengan form versi ke berapa
    // NULLABLE, bukan NOT NULL: Form Kegiatan Pemberdayaan tidak punya warga
    // tetap per-submission, jadi submission kegiatan menyimpan NULL di sini.
    // Aturan "form ini wajib atau tidak terisi warga" datang dari
    // `forms.subjekWargaWajib` dan dijaga di backend, karena butuh isi
    // `form_versions` yang tidak ada di tabel ini.
    wargaNik: varchar({ length: 16 }).references(() => dataWargaTable.nik), // penanda terhubung dengan data warga apa
    petugasId: uuid()
      .notNull()
      .references(() => users.id), // penanda terhubung dengan petugas atau surveyor
    tanggal: date().notNull(), // tanggal pelaksanaan survey
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    // Empat filter yang dipakai layar utama: "survey bulan ini", "riwayat warga ini",
    // "survey petugas ini", dan lookup versi saat render. Tanpa index ini tiap filter
    // scan seluruh tabel — dan tabel ini berisi data kesehatan warga.
    index('surveys_form_version_id_idx').on(t.formVersionId),
    index('surveys_warga_nik_idx').on(t.wargaNik),
    index('surveys_petugas_id_idx').on(t.petugasId),
    index('surveys_tanggal_idx').on(t.tanggal),
    // Digabung untuk filter "survey petugas X bulan ini" supaya tidak pilih antara
    // index tanggal atau index petugas.
    index('surveys_petugas_tanggal_idx').on(t.petugasId, t.tanggal),
  ],
)

export const surveyEntries = pgTable.withRLS(
  'survey_entries',
  {
    id: uuid().primaryKey().defaultRandom(),
    surveyId: uuid()
      .notNull()
      .references(() => surveys.id, { onDelete: 'cascade' }), // penanda terhubung dengan survey yang mana
    // Field ditautkan lewat UUID stabil di form_versions.schema. JSONB tidak
    // bisa menjadi target FK, jadi server memvalidasi ID terhadap versi survey.
    fieldId: uuid().notNull(), // ID stabil dari field di `form_versions.schema`.
    value: jsonb(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('survey_entries_survey_id_field_id').on(t.surveyId, t.fieldId),
    // Recap per field ("berapa warga dengan TD tinggi?") memfilter lewat fieldId.
    index('survey_entries_field_id_idx').on(t.fieldId),
  ],
)

// Jejak audit untuk data warga. Sengaja dipisah dari log aplikasi: log aplikasi bisa
// dirotasi, tabel ini tidak, dan isinya dibutuhkan untuk investigasi kebocoran NIK.
export const auditLogs = pgTable.withRLS(
  'audit_logs',
  {
    id: uuid().primaryKey().defaultRandom(),
    // SET NULL: petugas dihapuspun jejaknya harus tetap ada, cuma tidak lagi tertaut akun.
    userId: uuid().references(() => users.id, { onDelete: 'set null' }),
    aksi: auditAction().notNull(),
    entitas: varchar({ length: 40 }).notNull(), // nama tabel, mis. surveys | data_warga
    entitasId: varchar({ length: 64 }), // id baris yang diubah, kalau ada
    // NIK DISIMPAN SUDAH DISAMAR (4 depan + 4 belakang). NIK mentah tidak boleh masuk
    // tabel ini: kolomnya dibaca siapa pun yang punya akses DB, termasuk saat backup.
    nikMasked: varchar({ length: 16 }),
    sebelum: jsonb(), // nilai lama
    sesudah: jsonb(), // nilai baru
    ip: varchar({ length: 64 }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    // "Apa saja yang diubah petugas ini?" dan "siapa yang lihat data warga ini?" —
    // dua pertanyaan yang paling sering ditanya saat investigasi.
    index('audit_logs_user_created_idx').on(t.userId, t.createdAt),
    index('audit_logs_entitas_idx').on(t.entitas, t.entitasId),
    index('audit_logs_created_idx').on(t.createdAt),
  ],
)

export const validSession = pgTable.withRLS('valid_session', {
  uid: uuid().primaryKey().defaultRandom(),
  token: text().notNull().unique(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
})

/**
 * Penghitung kegagalan login per alamat IP.
 *
 * Satu-satunya gerbang aplikasi adalah satu PIN global (lihat `isValidPin`),
 * jadi ini yang menjaga PIN itu tidak bisa ditebak. Tanpa tabel ini, rate limit
 * hanya bisa hidup di memory proses — di Vercel tiap instance punya memory
 * sendiri dan restart saat cold start, jadi penghitungnya bisa direset dengan
 * mengirim request ke instance berbeda. Disimpan di DB karena satu-satunya
 * tempat yang benar-benar shared antar-instance.
 *
 * `ip` adalah kunci: tidak ada tabel user karena tidak ada user per-akun.
 * Baris dihapus setelah tidak ada lock (lihat `bersihkanKedaluwarsa`).
 */
export const pinAttempts = pgTable.withRLS('pin_attempts', {
  ip: varchar({ length: 64 }).primaryKey(),
  gagalBerturut: integer('gagal_berturut').notNull().default(0),
  terkunciSampai: timestamp('terkunci_sampai', { withTimezone: true }),
  terakhirGagal: timestamp('terakhir_gagal', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const pushSubscriptions = pgTable.withRLS(
  'push_subscriptions',
  {
    id: uuid().primaryKey().defaultRandom(),
    endpoint: text().notNull(),
    p256dh: text().notNull(),
    auth: text().notNull(),
    userAgent: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp({ withTimezone: true }),
  },
  (t) => [unique('push_subscriptions_endpoint_unique').on(t.endpoint)],
)

/**
 * Penanda pengiriman cron notifikasi.
 *
 * Cron bisa dipanggil ulang: retry Vercel, uji manual, atau dua instance yang
 * tumpang tindih. Tanpa penanda, setiap panggilan mengirim push yang sama lagi.
 * Kuncinya (`YYYY-MM-DD:<sidik peringatan>`, lihat `lib/notifikasi/idempotensi.ts`)
 * membuat pengiriman untuk hari dan daftar peringatan yang sama hanya terjadi
 * sekali.
 *
 * Baris dipakai sebagai klaim sebelum kirim: `INSERT ... ON CONFLICT DO NOTHING`
 * yang berhasil berarti proses ini pemilik pengiriman. Kalau push gagal total,
 * baris dihapus supaya panggilan berikutnya boleh mencoba lagi.
 */
export const cronNotifikasiTerkirim = pgTable('cron_notifikasi_terkirim', {
  kunci: varchar({ length: 80 }).primaryKey(),
  hari: date().notNull(),
  terkirim: integer().notNull().default(0),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})
