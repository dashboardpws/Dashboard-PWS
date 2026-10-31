import {
  check,
  date,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  varchar,
  boolean,
  timestamp,
  uuid,
  jsonb,
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
  formFieldType,
  auditAction,
} from './type-enum'

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

export const dataWargaTable = pgTable('data_warga', {
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

export const wilayahKerja = pgTable(
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

export const fasilitasKesehatan = pgTable(
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
export const users = pgTable(
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
export const forms = pgTable(
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

export const formVersions = pgTable(
  'form_versions',
  {
    id: uuid().primaryKey().defaultRandom(),
    formId: smallint()
      .notNull()
      .references(() => forms.id, { onDelete: 'cascade' }),
    version: integer().notNull(),
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
      sql`${t.status} IN ('draft', 'published', 'archived')`,
    ),
    check('form_versions_version_check', sql`${t.version} >= 1`),
    // Versi published wajib punya publishedAt, kalau tidak rekap "ber kapan form ini
    // tayang" jadi tidak bisa dijawab.
    check(
      'form_versions_published_at_check',
      sql`${t.status} <> 'published' or ${t.publishedAt} is not null`,
    ),
  ],
)

// tabel untuk membagi form jadi beberapa bagian
export const formSections = pgTable(
  'form_sections',
  {
    id: uuid().primaryKey().defaultRandom(),
    formVersionId: uuid()
      .notNull()
      .references(() => formVersions.id, { onDelete: 'cascade' }),
    nama: varchar({ length: 100 }).notNull(),
    deskripsi: text(),
    urutan: integer().notNull(),
    aktif: boolean().notNull().default(true),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    // Syarat FK komposit form_fields (sectionId, formVersionId) -> (id, formVersionId).
    // Postgres butuh kolom target punya UNIQUE persis di kombinasi itu.
    uniqueIndex('form_sections_id_form_version_id').on(t.id, t.formVersionId),
    index('form_sections_form_version_urutan_idx').on(
      t.formVersionId,
      t.urutan,
    ),
  ],
)

// tabel pertanyaan tiap section
export const formFields = pgTable(
  'form_fields',
  {
    id: uuid().primaryKey().defaultRandom(),
    // formVersionId didenormalisasi dari section supaya `nama` bisa dijamin unik per
    // versi form (lihat uniqueIndex di bawah) dan supaya validasi "field ini milik
    // versi mana?" cukup satu join, tanpa lewat form_sections. Konsistensinya dengan
    // section dijamin FK komposit, jadi kolom ini tidak bisa menyimpang diam-diam.
    formVersionId: uuid()
      .notNull()
      .references(() => formVersions.id, { onDelete: 'cascade' }),
    sectionId: uuid().notNull(), // selalu terhubung dengan section
    nama: varchar({ length: 100 }).notNull(), // identifier teknis, mis. tekanan_darah
    label: varchar({ length: 255 }).notNull(), // teks yang dilihat petugas
    tipe: formFieldType().notNull(), // text | number | date | select | radio | checkbox | time
    optionSourceType: varchar({ length: 30 }),
    optionSourceKey: varchar({ length: 100 }),
    deskripsi: text(),
    placeholder: varchar({ length: 255 }),
    wajib: boolean().notNull().default(false), // wajib diisi atau tidak
    urutan: integer().notNull().default(0), // urutan tampilan
    // Berapa kolom yang boleh diisi per baris untuk tipe 'group' (mis. 3 kolom
    // untuk anggota keluarga: NIK, nama, hubungan). NULL untuk tipe selain
    // 'group'. Nilai ini hanya dipakai editor dan validasi backend; database
    // tidak menyimpan struktur kolom anak karena jawaban 'group' berupa array
    // jsonb di `survey_entries.value`.
    jumlahKolom: integer(),
    aktif: boolean().notNull().default(true), // tampilkan atau tidak
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    // Set SEBELUM references() tunggal: composite FK ini yang memastikan field dan
    // section-nya memang versi form yang sama. Kalau hanya FK ke sectionId, kolom
    // formVersionId bisa diisi versi lain dan unique index di bawah jadi bohong.
    foreignKey({
      columns: [t.sectionId, t.formVersionId],
      foreignColumns: [formSections.id, formSections.formVersionId],
      name: 'form_fields_section_version_fk',
    }).onDelete('cascade'),
    // `nama` = identifier teknis yang dipanggil kode saat menyimpan jawaban, jadi
    // unik per versi form. Boleh sama di dua versi berbeda karena answer lama
    // di-pin ke formVersionId lewat survey_entries.surveyId.
    uniqueIndex('form_fields_form_version_nama_key').on(
      t.formVersionId,
      t.nama,
    ),
    index('form_fields_section_urutan_idx').on(t.sectionId, t.urutan),
  ],
)

// Tabel pilihan jawaban (`option`) untuk setiap field.
//
// Semula tabel ini juga menampung aturan visibility — "tampilkan field ini hanya
// bila field lain bernilai X". Aturan itu dihapus: tidak pernah dipakai di data
// mana pun, dan menambah tiga kolom (tipe, sourceFieldId, operator) plus satu
// enum untuk sesuatu yang nol. Sekarang satu baris = satu pilihan jawaban.
export const formFieldOptions = pgTable(
  'form_field_options',
  {
    id: uuid().primaryKey().defaultRandom(),
    fieldId: uuid()
      .notNull()
      .references(() => formFields.id, { onDelete: 'cascade' }), // opsi milik pertanyaan ini
    value: text().notNull(), // yang disimpan di payload jawaban
    label: varchar({ length: 255 }), // yang ditulis petugas, mis. "Tidak/Belum Sekolah"
    urutan: integer().notNull().default(0), // urutan pilihan
    aktif: boolean().notNull().default(true),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    // Opsi field selalu ikut section berurutan saat form dirender.
    index('form_field_options_field_urutan_idx').on(t.fieldId, t.urutan),
  ],
)

// tabel hasil dan riwayat survey
export const surveys = pgTable(
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

export const surveyEntries = pgTable(
  'survey_entries',
  {
    id: uuid().primaryKey().defaultRandom(),
    surveyId: uuid()
      .notNull()
      .references(() => surveys.id, { onDelete: 'cascade' }), // penanda terhubung dengan survey yang mana
    // CATATAN: FK ke form_fields hanya memastikan field-nya ADA, bukan bahwa field itu
    // milik formVersionId milik survey. Aturan itu divalidasi di backend sebelum insert
    fieldId: uuid()
      .notNull()
      .references(() => formFields.id), // penanda terhubung dengan question apa
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
export const auditLogs = pgTable(
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

export const validSession = pgTable('valid_session', {
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
export const pinAttempts = pgTable('pin_attempts', {
  ip: varchar({ length: 64 }).primaryKey(),
  gagalBerturut: integer('gagal_berturut').notNull().default(0),
  terkunciSampai: timestamp('terkunci_sampai', { withTimezone: true }),
  terakhirGagal: timestamp('terakhir_gagal', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const pushSubscriptions = pgTable('push_subscriptions', {
  id: uuid().primaryKey().defaultRandom(),
  endpoint: text().notNull().unique(),
  p256dh: text().notNull(),
  auth: text().notNull(),
  userAgent: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp({ withTimezone: true }),
})

/**
 * Aturan autofill dinamis untuk Form Builder.
 * Menghubungkan field pemicu (biasanya field dengan optionSourceType 'cari_warga')
 * ke field target dengan konfigurasi sumber data dan transformasi.
 */
export const formFieldAutofills = pgTable(
  'form_field_autofills',
  {
    id: uuid().primaryKey().defaultRandom(),
    formVersionId: uuid()
      .notNull()
      .references(() => formVersions.id, { onDelete: 'cascade' }),
    // Field yang memicu autofill
    triggerFieldId: uuid()
      .notNull()
      .references(() => formFields.id, { onDelete: 'cascade' }),
    // Field yang diisi otomatis
    targetFieldId: uuid()
      .notNull()
      .references(() => formFields.id, { onDelete: 'cascade' }),
    // Sumber data untuk mengambil nilai
    sumber: varchar({ length: 10 }).notNull(), // 'warga' | 'anggota' | 'riwayat'
    // Key/kolom sumber
    kolom: varchar({ length: 50 }).notNull(),
    // Transformasi nilai sebelum diisi
    transform: varchar({ length: 10 }).notNull().default('teks'), // 'teks'|'nik'|'tanggal'|'opsi'|'angka'
    // Perilaku saat mengisi
    mode: varchar({ length: 12 }).notNull().default('isi_kosong'), // 'isi_kosong'|'timpa'
    urutan: integer().notNull().default(0),
    aktif: boolean().notNull().default(true),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('form_field_autofills_form_version_idx').on(t.formVersionId),
    index('form_field_autofills_trigger_idx').on(t.triggerFieldId),
    index('form_field_autofills_target_idx').on(t.targetFieldId),
    // Satu mapping per (trigger, target, sumber, kolom) biar tidak dobel
    uniqueIndex('form_field_autofills_unique_idx').on(
      t.triggerFieldId,
      t.targetFieldId,
      t.sumber,
      t.kolom,
    ),
    check(
      'form_field_autofills_sumber_check',
      sql`${t.sumber} IN ('warga','anggota','riwayat')`,
    ),
    check(
      'form_field_autofills_transform_check',
      sql`${t.transform} IN ('teks','nik','tanggal','opsi','angka')`,
    ),
    check(
      'form_field_autofills_mode_check',
      sql`${t.mode} IN ('isi_kosong','timpa')`,
    ),
  ],
)

/**
 * Aturan visibilitas kondisional untuk field atau section.
 * Menentukan kapan suatu field/section muncul berdasarkan nilai field pemicu.
 */
export const formFieldVisibilityRules = pgTable(
  'form_field_visibility_rules',
  {
    id: uuid().primaryKey().defaultRandom(),
    formVersionId: uuid()
      .notNull()
      .references(() => formVersions.id, { onDelete: 'cascade' }),
    // Target yang dikontrol
    targetType: varchar({ length: 8 }).notNull(), // 'field' | 'section'
    targetId: uuid().notNull(),
    // Field pemicu
    triggerFieldId: uuid()
      .notNull()
      .references(() => formFields.id, { onDelete: 'cascade' }),
    // Operator evaluasi
    operator: varchar({ length: 12 }).notNull(), // 'eq'|'neq'|'in'|'nin'|'kosong'|'tidak_kosong'
    // Nilai acuan (bisa string/number/array). Pakai jsonb biar fleksibel
    nilaiAcuan: jsonb()
      .notNull()
      .default(sql`'[]'::jsonb`),
    aktif: boolean().notNull().default(true),
    urutan: integer().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('form_field_vis_form_version_idx').on(t.formVersionId),
    index('form_field_vis_target_idx').on(t.targetType, t.targetId),
    index('form_field_vis_trigger_idx').on(t.triggerFieldId),
    check(
      'form_field_vis_target_type_check',
      sql`${t.targetType} IN ('field','section')`,
    ),
    check(
      'form_field_vis_operator_check',
      sql`${t.operator} IN ('eq','neq','in','nin','kosong','tidak_kosong')`,
    ),
  ],
)
