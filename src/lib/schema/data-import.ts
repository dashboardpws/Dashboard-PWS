import {
  date,
  index,
  pgPolicy,
  pgTable,
  text,
  varchar,
  boolean,
  smallint,
  numeric,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import {
  hubunganKeluargaEnum,
  jenisKelaminEnum,
  statusKawinEnum,
  agama,
  pendidikanEnum,
} from './type-enum'

export const dataWargaImport = pgTable(
  'data_warga_import',
  {
    rawId: varchar('raw_id').primaryKey(),
    namaKk: varchar('nama_kk'),
    nik: varchar('nik'),
    jumlahArt: smallint('jumlah_art'),
    namaArt: varchar('nama_art'),
    hubunganKeluarga: hubunganKeluargaEnum('hubungan_keluarga'),
    tglLahir: date('tgl_lahir', { mode: 'string' }),
    jenisKelamin: jenisKelaminEnum('jenis_kelamin'),
    statusKawin: statusKawinEnum('status_kawin'),
    agama: agama(),
    pendidikan: pendidikanEnum(),
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
  (t) => [
    // 20.454 baris, dan sampai sekarang satu-satunya index adalah primary key
    // `raw_id`. Tanpa ini `WHERE nik = $1` (dipakai saat menyimpan warga dari form
    // Kunjungan Rumah) scan seluruh tabel.
    index('data_warga_import_nik_idx').on(t.nik),
    // Pencarian partial `nama_art`/`nama_kk`/`nik` ILIKE '%q%' butuh operator class
    // trigram, yang tidak bisa ditulis di sini — `IndexBuilder` hanya menerima
    // PgIndexMethod dan kolom, bukan opclass bebas. Index GIN-nya dibuat lewat
    // drizzle/manual/20261001_data_warga_import-index.sql.
    pgPolicy('Allow read-only access', {
      as: 'restrictive',
      for: 'select',
      to: ['authenticated'],
      using: sql`true`,
    }),
  ],
)

export const riwayatKsImport = pgTable(
  'riwayat_ks_import',
  {
    rawId: varchar('raw_id')
      .primaryKey()
      .references(() => dataWargaImport.rawId, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
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
