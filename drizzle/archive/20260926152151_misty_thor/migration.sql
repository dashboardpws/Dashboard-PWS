ALTER TABLE "data_warga_import" ALTER COLUMN "agama" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "data_warga" ALTER COLUMN "agama" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "agama";--> statement-breakpoint
CREATE TYPE "agama" AS ENUM('Budha', 'Hindu', 'Islam', 'Katholik', 'Kristen', 'Konghucu');--> statement-breakpoint
ALTER TABLE "data_warga_import" ALTER COLUMN "agama" SET DATA TYPE "agama" USING "agama"::"agama";--> statement-breakpoint
ALTER TABLE "data_warga" ALTER COLUMN "agama" SET DATA TYPE "agama" USING "agama"::"agama";