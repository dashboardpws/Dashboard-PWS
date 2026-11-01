CREATE TABLE "valid_session" (
	"uid" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"token" text NOT NULL
);
--> statement-breakpoint
-- [perbaikan] FK dependent dibuang dulu — expect: konversi tipe surveyor.id tak ditolak
--   Postgres ("cannot be implemented" karena riwayat_survey.petugas_id masih integer).
--   Tabel riwayat_survey sendiri di-DROP di migration berikutnya, jadi FK ini memang tak dipakai.
ALTER TABLE "riwayat_survey" DROP CONSTRAINT "riwayat_survey_petugas_id_surveyor_id_fkey";
--> statement-breakpoint
-- [perbaikan] 3 baris ALTER "riwayat_survey" dihapus — expect: migration lolos di DB fresh.
--   Alasan: cast integer::uuid tidak ada di Postgres (selalu gagal), dan tabel "riwayat_survey"
--   memang DROP di migration berikutnya (20260926) sehingga konversi tipenya sia-sia.
ALTER TABLE "surveyor" ALTER COLUMN "id" DROP IDENTITY;--> statement-breakpoint
-- [perbaikan] urutan konversi surveyor.id integer→uuid ditulis ulang aman — expect: lolos.
--   integer→text valid; text→uuid valid secara tipe dan tak mengevaluasi nilai apa pun
--   selama tabel masih kosong (target arya: id surveyor jadi uuid).
ALTER TABLE "surveyor" ALTER COLUMN "id" SET DATA TYPE text USING "id"::text;--> statement-breakpoint
ALTER TABLE "surveyor" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::text::uuid;--> statement-breakpoint
ALTER TABLE "surveyor" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
