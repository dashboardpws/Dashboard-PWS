ALTER TABLE "data_warga_import" ADD COLUMN "public_id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "data_warga" ADD COLUMN "public_id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "data_warga_import_public_id_idx" ON "data_warga_import" ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "data_warga_public_id_idx" ON "data_warga" ("public_id");