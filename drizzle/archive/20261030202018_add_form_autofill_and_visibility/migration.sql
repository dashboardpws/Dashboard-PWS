CREATE TABLE "form_field_autofills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"formVersionId" uuid NOT NULL,
	"triggerFieldId" uuid NOT NULL,
	"targetFieldId" uuid NOT NULL,
	"sumber" varchar(10) NOT NULL,
	"kolom" varchar(50) NOT NULL,
	"transform" varchar(10) DEFAULT 'teks' NOT NULL,
	"mode" varchar(12) DEFAULT 'isi_kosong' NOT NULL,
	"urutan" integer DEFAULT 0 NOT NULL,
	"aktif" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "form_field_autofills_sumber_check" CHECK ("sumber" IN ('warga','anggota','riwayat')),
	CONSTRAINT "form_field_autofills_transform_check" CHECK ("transform" IN ('teks','nik','tanggal','opsi','angka')),
	CONSTRAINT "form_field_autofills_mode_check" CHECK ("mode" IN ('isi_kosong','timpa'))
);
--> statement-breakpoint
CREATE TABLE "form_field_visibility_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"formVersionId" uuid NOT NULL,
	"targetType" varchar(8) NOT NULL,
	"targetId" uuid NOT NULL,
	"triggerFieldId" uuid NOT NULL,
	"operator" varchar(12) NOT NULL,
	"nilaiAcuan" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"aktif" boolean DEFAULT true NOT NULL,
	"urutan" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "form_field_vis_target_type_check" CHECK ("targetType" IN ('field','section')),
	CONSTRAINT "form_field_vis_operator_check" CHECK ("operator" IN ('eq','neq','in','nin','kosong','tidak_kosong'))
);
--> statement-breakpoint
CREATE INDEX "form_field_autofills_form_version_idx" ON "form_field_autofills" USING btree ("formVersionId");
--> statement-breakpoint
CREATE INDEX "form_field_autofills_trigger_idx" ON "form_field_autofills" USING btree ("triggerFieldId");
--> statement-breakpoint
CREATE INDEX "form_field_autofills_target_idx" ON "form_field_autofills" USING btree ("targetFieldId");
--> statement-breakpoint
CREATE UNIQUE INDEX "form_field_autofills_unique_idx" ON "form_field_autofills" USING btree ("triggerFieldId","targetFieldId","sumber","kolom");
--> statement-breakpoint
CREATE INDEX "form_field_vis_form_version_idx" ON "form_field_visibility_rules" USING btree ("formVersionId");
--> statement-breakpoint
CREATE INDEX "form_field_vis_target_idx" ON "form_field_visibility_rules" USING btree ("targetType","targetId");
--> statement-breakpoint
CREATE INDEX "form_field_vis_trigger_idx" ON "form_field_visibility_rules" USING btree ("triggerFieldId");
--> statement-breakpoint
ALTER TABLE "form_field_autofills" ADD CONSTRAINT "form_field_autofills_formVersionId_form_versions_id_fk" FOREIGN KEY ("formVersionId") REFERENCES "form_versions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "form_field_autofills" ADD CONSTRAINT "form_field_autofills_triggerFieldId_form_fields_id_fk" FOREIGN KEY ("triggerFieldId") REFERENCES "form_fields"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "form_field_autofills" ADD CONSTRAINT "form_field_autofills_targetFieldId_form_fields_id_fk" FOREIGN KEY ("targetFieldId") REFERENCES "form_fields"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "form_field_visibility_rules" ADD CONSTRAINT "form_field_vis_formVersionId_form_versions_id_fk" FOREIGN KEY ("formVersionId") REFERENCES "form_versions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "form_field_visibility_rules" ADD CONSTRAINT "form_field_vis_triggerFieldId_form_fields_id_fk" FOREIGN KEY ("triggerFieldId") REFERENCES "form_fields"("id") ON DELETE cascade ON UPDATE no action;
