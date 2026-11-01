CREATE TYPE "agama" AS ENUM('Islam', 'Kristen', 'Katolik', 'Hindu', 'Budha', 'Konghucu', 'Lainnya');--> statement-breakpoint
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
DROP TABLE "riwayat_survey";--> statement-breakpoint
ALTER TABLE "valid_session" ADD COLUMN "expiresAt" timestamp NOT NULL;--> statement-breakpoint
ALTER TABLE "data_warga" ALTER COLUMN "nik" SET DATA TYPE varchar(16) USING "nik"::varchar(16);--> statement-breakpoint
ALTER TABLE "data_warga" ALTER COLUMN "agama" SET DATA TYPE "agama" USING "agama"::"agama";--> statement-breakpoint
ALTER TABLE "valid_session" ADD CONSTRAINT "valid_session_token_key" UNIQUE("token");--> statement-breakpoint
ALTER TABLE "form_sections" ADD CONSTRAINT "form_sections_formId_forms_id_fkey" FOREIGN KEY ("formId") REFERENCES "forms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_sectionId_form_sections_id_fkey" FOREIGN KEY ("sectionId") REFERENCES "form_sections"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_parentId_questions_id_fkey" FOREIGN KEY ("parentId") REFERENCES "questions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "survey_images" ADD CONSTRAINT "survey_images_surveyId_surveys_id_fkey" FOREIGN KEY ("surveyId") REFERENCES "surveys"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "survey_images" ADD CONSTRAINT "survey_images_questionId_questions_id_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_formId_forms_id_fkey" FOREIGN KEY ("formId") REFERENCES "forms"("id");--> statement-breakpoint
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_nik_data_warga_nik_fkey" FOREIGN KEY ("nik") REFERENCES "data_warga"("nik");--> statement-breakpoint
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_petugasId_surveyor_id_fkey" FOREIGN KEY ("petugasId") REFERENCES "surveyor"("id");