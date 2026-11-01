DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_type WHERE typname = 'agama'
	) THEN
		CREATE TYPE "agama" AS ENUM(
			'Budha',
			'Hindu',
			'Islam',
			'Katholik',
			'Kristen',
			'Konghucu'
		);
	END IF;
END
$$;
--> statement-breakpoint

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_type WHERE typname = 'hubungan_keluarga'
	) THEN
		CREATE TYPE "hubungan_keluarga" AS ENUM(
			'Anak',
			'Istri',
			'Orang Tua',
			'Kepala Keluarga',
			'Cucu',
			'Famili lain',
			'Mertua',
			'Menantu',
			'Pembantu',
			'Lainnya',
			'Suami'
		);
	END IF;
END
$$;
--> statement-breakpoint

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_type WHERE typname = 'jenis_kelamin'
	) THEN
		CREATE TYPE "jenis_kelamin" AS ENUM(
			'laki-laki',
			'perempuan'
		);
	END IF;
END
$$;
--> statement-breakpoint

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_type WHERE typname = 'pendidikan'
	) THEN
		CREATE TYPE "pendidikan" AS ENUM(
			'SLTA/Sederajat',
			'Tidak/Belum Sekolah',
			'Belum Tamat SD/Sederajat',
			'SLTP/Sederajat',
			'Strata III',
			'Diploma IV/Strata I',
			'Akademi/Diploma III/ Sarjana Muda',
			'Tamat SD/Sederajat',
			'Strata-II',
			'Diploma I/II'
		);
	END IF;
END
$$;
--> statement-breakpoint

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_type WHERE typname = 'status_kawin'
	) THEN
		CREATE TYPE "status_kawin" AS ENUM(
			'belum kawin',
			'kawin',
			'cerai mati',
			'cerai hidup'
		);
	END IF;
END
$$;
--> statement-breakpoint

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

CREATE TABLE "data_warga" (
	"nik" varchar(16) PRIMARY KEY,
	"nama_art" varchar(255) NOT NULL,
	"nama_kk" varchar(255) NOT NULL,
	"hubungan_keluarga" "hubungan_keluarga" NOT NULL,
	"alamat" text NOT NULL,
	"tgl_lahir" date NOT NULL,
	"rt" integer NOT NULL,
	"rw" integer NOT NULL,
	"kecamatan" text NOT NULL,
	"kelurahan" text NOT NULL,
	"kota" text NOT NULL,
	"status_kawin" "status_kawin" NOT NULL,
	"petugas" text NOT NULL,
	"jenis_kelamin" "jenis_kelamin" NOT NULL,
	"wanita_usia_hamil" boolean NOT NULL,
	"agama" "agama" NOT NULL,
	"pendidikan" "pendidikan" NOT NULL,
	"pekerjaan" text NOT NULL
);
--> statement-breakpoint

CREATE TABLE "form_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"formId" uuid NOT NULL,
	"nama" varchar(100) NOT NULL,
	"deskripsi" text,
	"urutan" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "forms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"nama" varchar(100) NOT NULL,
	"deskripsi" text,
	"aktif" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "kegiatan_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"payload" jsonb NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "kunjungan_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"payload" jsonb NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"sectionId" uuid NOT NULL,
	"parentId" uuid,
	"pertanyaan" text NOT NULL,
	"tipe" varchar(30) NOT NULL,
	"wajib" boolean DEFAULT false NOT NULL,
	"urutan" integer NOT NULL,
	"aktif" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
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

CREATE TABLE "survey_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"surveyId" uuid NOT NULL,
	"questionId" uuid NOT NULL,
	"fileUrl" text NOT NULL,
	"fileName" varchar(255),
	"mimeType" varchar(100),
	"fileSize" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "surveyor" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"nama" varchar(255) NOT NULL
);
--> statement-breakpoint

CREATE TABLE "surveys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"formId" uuid NOT NULL,
	"nik" varchar(16) NOT NULL,
	"petugasId" uuid NOT NULL,
	"tanggal" date NOT NULL,
	"jawaban" jsonb NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "valid_session" (
	"uid" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"token" text NOT NULL UNIQUE,
	"expiresAt" timestamp NOT NULL
);
--> statement-breakpoint

ALTER TABLE "form_sections"
ADD CONSTRAINT "form_sections_formId_forms_id_fkey"
FOREIGN KEY ("formId") REFERENCES "forms"("id") ON DELETE CASCADE;
--> statement-breakpoint

ALTER TABLE "questions"
ADD CONSTRAINT "questions_sectionId_form_sections_id_fkey"
FOREIGN KEY ("sectionId") REFERENCES "form_sections"("id") ON DELETE CASCADE;
--> statement-breakpoint

ALTER TABLE "questions"
ADD CONSTRAINT "questions_parentId_questions_id_fkey"
FOREIGN KEY ("parentId") REFERENCES "questions"("id") ON DELETE CASCADE;
--> statement-breakpoint

ALTER TABLE "riwayat_ks_import"
ADD CONSTRAINT "riwayat_ks_import_raw_id_data_warga_import_raw_id_fkey"
FOREIGN KEY ("raw_id") REFERENCES "data_warga_import"("raw_id")
ON DELETE CASCADE ON UPDATE CASCADE;
--> statement-breakpoint

ALTER TABLE "survey_images"
ADD CONSTRAINT "survey_images_surveyId_surveys_id_fkey"
FOREIGN KEY ("surveyId") REFERENCES "surveys"("id") ON DELETE CASCADE;
--> statement-breakpoint

ALTER TABLE "survey_images"
ADD CONSTRAINT "survey_images_questionId_questions_id_fkey"
FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE;
--> statement-breakpoint

ALTER TABLE "surveys"
ADD CONSTRAINT "surveys_formId_forms_id_fkey"
FOREIGN KEY ("formId") REFERENCES "forms"("id");
--> statement-breakpoint

ALTER TABLE "surveys"
ADD CONSTRAINT "surveys_nik_data_warga_nik_fkey"
FOREIGN KEY ("nik") REFERENCES "data_warga"("nik");
--> statement-breakpoint

ALTER TABLE "surveys"
ADD CONSTRAINT "surveys_petugasId_surveyor_id_fkey"
FOREIGN KEY ("petugasId") REFERENCES "surveyor"("id");