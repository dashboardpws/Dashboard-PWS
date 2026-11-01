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
