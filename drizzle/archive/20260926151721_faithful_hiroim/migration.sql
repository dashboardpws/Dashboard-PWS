ALTER TYPE "pendidikan" ADD VALUE 'Diploma I/II';--> statement-breakpoint
CREATE TABLE "data_warga_import" (
	"raw_id" varchar PRIMARY KEY,
	"nama_kk" varchar,
	"nik" varchar,
	"jumlah_art" smallint,
	"nama_art" varchar,
	"hubunganKeluarga" "hubungan_keluarga",
	"tgl_lahir" date,
	"jenisKelamin" "jenis_kelamin",
	"statusKawin" "status_kawin",
	"agama" "agama",
	"pendidikan" "pendidikan",
	"pekerjaan" text,
	"alamat" text,
	"provinsi" text,
	"kabKota" text,
	"kecamatan" text,
	"kelurahan" text,
	"rw" smallint,
	"rt" smallint,
	"iksBesar" numeric
);
--> statement-breakpoint
CREATE TABLE "riwayat_ks_import" (
	"raw_id" varchar PRIMARY KEY,
	"kepesertaanJkn" boolean,
	"merokok" boolean,
	"tersediaSaranaAirBersih" boolean,
	"jenisSumberAirTerlindung" text,
	"tersediaJambanKeluarga" boolean,
	"jenisJambanSaniter" text,
	"diagnosisOdgj" boolean,
	"minumObatOdgjTeratur" boolean,
	"adaArtDipasung" boolean,
	"perilakuBabDijamban" text,
	"perilakuPenggunaanAirBersih" text,
	"diagnosisTbParu" boolean,
	"minumObatTbTeratur" boolean,
	"batukBerdahakLebihDari2Minggu" boolean,
	"diagnosisHipertensi" boolean,
	"pengkuranTekananDarah" boolean,
	"minumObatHipertensiTeratur" boolean,
	"sistolik" smallint,
	"diastolik" smallint,
	"pakaiKb" boolean,
	"ketKb" text,
	"persalinanDiFaskes" boolean,
	"asiEksklusif" boolean,
	"imunisasiLengkap" boolean
);
--> statement-breakpoint
ALTER TABLE "data_warga" ALTER COLUMN "agama" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "agama";--> statement-breakpoint
CREATE TYPE "agama" AS ENUM('Islam', 'Kristen', 'Katholik', 'Hindu', 'Budha', 'Konghucu');--> statement-breakpoint
ALTER TABLE "data_warga" ALTER COLUMN "agama" SET DATA TYPE "agama" USING "agama"::"agama";--> statement-breakpoint
ALTER TABLE "riwayat_ks_import" ADD CONSTRAINT "riwayat_ks_import_raw_id_data_warga_import_raw_id_fkey" FOREIGN KEY ("raw_id") REFERENCES "data_warga_import"("raw_id") ON DELETE CASCADE ON UPDATE CASCADE;