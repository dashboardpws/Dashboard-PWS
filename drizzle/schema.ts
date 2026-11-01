import {
  pgEnum,
  pgTable,
  uuid,
  varchar,
  smallint,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  date,
  numeric,
  index,
  uniqueIndex,
  unique,
  check,
  pgPolicy,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const agama = pgEnum('agama', [
  'Budha',
  'Hindu',
  'Islam',
  'Katholik',
  'Kristen',
  'Konghucu',
])
export const auditAction = pgEnum('audit_action', [
  'create',
  'read',
  'update',
  'delete',
  'publish',
  'login',
  'logout',
])
export const jenisFasKes = pgEnum('jenis_fas_kes', ['Posyandu', 'Pustu'])
export const hubunganKeluarga = pgEnum('hubungan_keluarga', [
  'Kepala Keluarga',
  'Orang Tua',
  'Suami',
  'Istri',
  'Anak',
  'Mertua',
  'Menantu',
  'Cucu',
  'Pembantu',
  'Famili lain',
  'Lainnya',
])
export const jenisKelamin = pgEnum('jenis_kelamin', ['laki-laki', 'perempuan'])
export const pekerjaan = pgEnum('pekerjaan', [
  'Petani',
  'Buruh',
  'Nelayan',
  'PNS',
  'Pedagang',
  'SWASTA',
  'IRT',
  'Pelajar/Mahasiswa',
  'Tidak Bekerja',
  'Lainnya',
])
export const pendidikan = pgEnum('pendidikan', [
  'SLTA/Sederajat',
  'Tidak/Belum Sekolah',
  'Belum Tamat SD/Sederajat',
  'SLTP/Sederajat',
  'Strata III',
  'Diploma IV/Strata I',
  'Akademi/Diploma III/ Sarjana Muda',
  'Tamat SD/Sederajat',
  'Strata-II',
  'Diploma I/II',
])
export const statusKawin = pgEnum('status_kawin', [
  'belum kawin',
  'kawin',
  'cerai mati',
  'cerai hidup',
])
export const formFieldType = pgEnum('form_field_type', [
  'text',
  'textarea',
  'number',
  'select',
  'radio',
  'checkbox',
  'date',
  'time',
  'image',
  'file',
  'group',
])

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: uuid().references(() => users.id, { onDelete: 'set null' }),
    aksi: auditAction().notNull(),
    entitas: varchar({ length: 40 }).notNull(),
    entitasId: varchar({ length: 64 }),
    nikMasked: varchar({ length: 16 }),
    sebelum: jsonb(),
    sesudah: jsonb(),
    ip: varchar({ length: 64 }),
    createdAt: timestamp({ withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => [
    index('audit_logs_created_idx').using(
      'btree',
      table.createdAt.asc().nullsLast(),
    ),
    index('audit_logs_entitas_idx').using(
      'btree',
      table.entitas.asc().nullsLast(),
      table.entitasId.asc().nullsLast(),
    ),
    index('audit_logs_user_created_idx').using(
      'btree',
      table.userId.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
  ],
)

export const dataWarga = pgTable('data_warga', {
  nik: varchar({ length: 16 }).primaryKey(),
  namaArt: varchar('nama_art', { length: 255 }).notNull(),
  namaKk: varchar('nama_kk', { length: 255 }).notNull(),
  hubunganKeluarga: hubunganKeluarga('hubungan_keluarga').notNull(),
  alamat: text().notNull(),
  tglLahir: date('tgl_lahir').notNull(),
  rt: varchar({ length: 3 }).notNull(),
  rw: varchar({ length: 3 }).notNull(),
  kecamatan: text().notNull(),
  kelurahan: text().notNull(),
  kota: text().notNull(),
  statusKawin: statusKawin('status_kawin').notNull(),
  staff: uuid()
    .notNull()
    .references(() => users.id),
  jenisKelamin: jenisKelamin('jenis_kelamin').notNull(),
  wanitaUsiaHamil: boolean('wanita_usia_hamil').notNull(),
  agama: agama().notNull(),
  pendidikan: pendidikan().notNull(),
  pekerjaan: pekerjaan().notNull(),
  createdAt: timestamp({ withTimezone: true })
    .default(sql`now()`)
    .notNull(),
  updatedAt: timestamp({ withTimezone: true })
    .default(sql`now()`)
    .notNull(),
})

export const dataWargaImport = pgTable.withRLS(
  'data_warga_import',
  {
    rawId: varchar('raw_id').primaryKey(),
    namaKk: varchar('nama_kk'),
    nik: varchar(),
    jumlahArt: smallint('jumlah_art'),
    namaArt: varchar('nama_art'),
    hubunganKeluarga: hubunganKeluarga('hubungan_keluarga'),
    tglLahir: date('tgl_lahir'),
    jenisKelamin: jenisKelamin('jenis_kelamin'),
    statusKawin: statusKawin('status_kawin'),
    agama: agama(),
    pendidikan: pendidikan(),
    pekerjaan: text(),
    alamat: text(),
    provinsi: text(),
    kabKota: text('kab_kota'),
    kecamatan: text(),
    kelurahan: text(),
    rw: smallint(),
    rt: smallint(),
    iksBesar: numeric('iks_besar'),
  },
  (table) => [
    index('data_warga_import_nik_idx').using(
      'btree',
      table.nik.asc().nullsLast(),
    ),

    pgPolicy('Allow read-only access', {
      as: 'restrictive',
      for: 'select',
      to: ['authenticated'],
      using: sql`true`,
    }),
  ],
)

export const fasilitasKesehatan = pgTable(
  'fasilitas_kesehatan',
  {
    id: smallint().primaryKey().generatedAlwaysAsIdentity(),
    wilayahKerjaId: smallint()
      .notNull()
      .references(() => wilayahKerja.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    fasKesType: jenisFasKes().notNull(),
    nama: varchar({ length: 20 }).notNull(),
    alamat: text().notNull(),
    rt: varchar({ length: 3 }),
    rw: varchar({ length: 3 }),
    createdAt: timestamp({ withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp({ withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => [
    index('fasilitas_kesehatan_wilayah_kerja_id_idx').using(
      'btree',
      table.wilayahKerjaId.asc().nullsLast(),
    ),
  ],
)

export const formVersions = pgTable(
  'form_versions',
  {
    id: uuid().defaultRandom().primaryKey(),
    formId: smallint()
      .notNull()
      .references(() => forms.id, { onDelete: 'cascade' }),
    version: integer().notNull(),
    status: varchar({ length: 20 }).default('draft').notNull(),
    publishedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp({ withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => [
    index('form_versions_form_id_status_idx').using(
      'btree',
      table.formId.asc().nullsLast(),
      table.status.asc().nullsLast(),
    ),
    uniqueIndex('form_versions_form_id_version').using(
      'btree',
      table.formId.asc().nullsLast(),
      table.version.asc().nullsLast(),
    ),
    check(
      'form_versions_published_at_check',
      sql`(((status)::text <> 'published'::text) OR ("publishedAt" IS NOT NULL))`,
    ),
    check(
      'form_versions_status_check',
      sql`((status)::text = ANY ((ARRAY['draft'::character varying, 'published'::character varying, 'archived'::character varying])::text[]))`,
    ),
    check('form_versions_version_check', sql`(version >= 1)`),
  ],
)

export const forms = pgTable(
  'forms',
  {
    id: smallint().primaryKey().generatedAlwaysAsIdentity(),
    nama: varchar({ length: 100 }).notNull(),
    deskripsi: text(),
    aktif: boolean().default(true).notNull(),
    createdAt: timestamp({ withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp({ withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    kode: varchar({ length: 50 }),
    subjekWargaWajib: boolean().default(true).notNull(),
  },
  (table) => [
    uniqueIndex('forms_kode_key').using('btree', table.kode.asc().nullsLast()),
    unique('forms_nama_key').on(table.nama),
  ],
)

export const pinAttempts = pgTable('pin_attempts', {
  ip: varchar({ length: 64 }).primaryKey(),
  gagalBerturut: integer('gagal_berturut').default(0).notNull(),
  terkunciSampai: timestamp('terkunci_sampai', { withTimezone: true }),
  terakhirGagal: timestamp('terakhir_gagal', { withTimezone: true })
    .default(sql`now()`)
    .notNull(),
})

export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: uuid().defaultRandom().primaryKey(),
    endpoint: text().notNull(),
    p256dh: text().notNull(),
    auth: text().notNull(),
    userAgent: text(),
    createdAt: timestamp({ withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    lastUsedAt: timestamp({ withTimezone: true }),
  },
  (table) => [unique('push_subscriptions_endpoint_unique').on(table.endpoint)],
)

export const riwayatKsImport = pgTable.withRLS(
  'riwayat_ks_import',
  {
    rawId: varchar('raw_id')
      .primaryKey()
      .references(() => dataWargaImport.rawId, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    kepesertaanJkn: boolean('kepesertaan_jkn'),
    merokok: boolean(),
    tersediaSaranaAirBersih: boolean('tersedia_sarana_air_bersih'),
    jenisSumberAirTerlindung: text('jenis_sumber_air_terlindung'),
    tersediaJambanKeluarga: boolean('tersedia_jamban_keluarga'),
    jenisJambanSaniter: text('jenis_jamban_saniter'),
    diagnosisOdgj: boolean('diagnosis_odgj'),
    minumObatOdgjTeratur: boolean('minum_obat_odgj_teratur'),
    adaArtDipasung: boolean('ada_art_dipasung'),
    perilakuBabDijamban: text('perilaku_bab_dijamban'),
    perilakuPenggunaanAirBersih: text('perilaku_penggunaan_air_bersih'),
    diagnosisTbParu: boolean('diagnosis_tb_paru'),
    minumObatTbTeratur: boolean('minum_obat_tb_teratur'),
    batukBerdahakLebihDari2Minggu: boolean(
      'batuk_berdahak_lebih_dari_2_minggu',
    ),
    diagnosisHipertensi: boolean('diagnosis_hipertensi'),
    pengkuranTekananDarah: boolean('pengkuran_tekanan_darah'),
    minumObatHipertensiTeratur: boolean('minum_obat_hipertensi_teratur'),
    sistolik: smallint(),
    diastolik: smallint(),
    pakaiKb: boolean('pakai_kb'),
    ketKb: text('ket_kb'),
    persalinanDiFaskes: boolean('persalinan_di_faskes'),
    asiEksklusif: boolean('asi_eksklusif'),
    imunisasiLengkap: boolean('imunisasi_lengkap'),
  },
  () => [
    pgPolicy('Allow read-only access', {
      as: 'restrictive',
      for: 'select',
      to: ['authenticated'],
      using: sql`true`,
    }),
  ],
)

export const surveyEntries = pgTable(
  'survey_entries',
  {
    id: uuid().defaultRandom().primaryKey(),
    surveyId: uuid()
      .notNull()
      .references(() => surveys.id, { onDelete: 'cascade' }),
    fieldId: uuid().notNull(),
    value: jsonb(),
    createdAt: timestamp({ withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp({ withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => [
    index('survey_entries_field_id_idx').using(
      'btree',
      table.fieldId.asc().nullsLast(),
    ),
    uniqueIndex('survey_entries_survey_id_field_id').using(
      'btree',
      table.surveyId.asc().nullsLast(),
      table.fieldId.asc().nullsLast(),
    ),
  ],
)

export const surveys = pgTable(
  'surveys',
  {
    id: uuid().defaultRandom().primaryKey(),
    formVersionId: uuid()
      .notNull()
      .references(() => formVersions.id),
    wargaNik: varchar({ length: 16 }).references(() => dataWarga.nik),
    petugasId: uuid()
      .notNull()
      .references(() => users.id),
    tanggal: date().notNull(),
    createdAt: timestamp({ withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp({ withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => [
    index('surveys_form_version_id_idx').using(
      'btree',
      table.formVersionId.asc().nullsLast(),
    ),
    index('surveys_petugas_id_idx').using(
      'btree',
      table.petugasId.asc().nullsLast(),
    ),
    index('surveys_petugas_tanggal_idx').using(
      'btree',
      table.petugasId.asc().nullsLast(),
      table.tanggal.asc().nullsLast(),
    ),
    index('surveys_tanggal_idx').using(
      'btree',
      table.tanggal.asc().nullsLast(),
    ),
    index('surveys_warga_nik_idx').using(
      'btree',
      table.wargaNik.asc().nullsLast(),
    ),
  ],
)

export const users = pgTable(
  'users',
  {
    id: uuid().defaultRandom().primaryKey(),
    fasKesId: smallint()
      .notNull()
      .references(() => fasilitasKesehatan.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    nama: varchar({ length: 255 }).notNull(),
    phone: varchar({ length: 20 }),
    aktif: boolean().default(true).notNull(),
    createdAt: timestamp({ withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp({ withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => [
    index('users_fas_kes_id_idx').using(
      'btree',
      table.fasKesId.asc().nullsLast(),
    ),
  ],
)

export const validSession = pgTable(
  'valid_session',
  {
    uid: uuid().defaultRandom().primaryKey(),
    token: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
  },
  (table) => [unique('valid_session_token_key').on(table.token)],
)

export const wilayahKerja = pgTable(
  'wilayah_kerja',
  {
    id: smallint().primaryKey().generatedAlwaysAsIdentity(),
    kecamatan: text().notNull(),
    kelurahan: text().notNull(),
    createdAt: timestamp({ withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp({ withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => [
    uniqueIndex('wilayah_kerja_kecamatan_kelurahan').using(
      'btree',
      table.kecamatan.asc().nullsLast(),
      table.kelurahan.asc().nullsLast(),
    ),
  ],
)
