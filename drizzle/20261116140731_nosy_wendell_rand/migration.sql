CREATE TABLE "prioritas_program" (
	"id" smallint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "prioritas_program_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 32767 START WITH 1 CACHE 1),
	"kode" varchar(50) NOT NULL UNIQUE,
	"nama" varchar(50) NOT NULL UNIQUE,
	"urutan" smallint DEFAULT 0 NOT NULL,
	"aktif" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "prioritas_program" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
INSERT INTO "prioritas_program" ("kode", "nama", "urutan", "aktif") VALUES
	('ODGJ', 'ODGJ', 1, true),
	('Bumil Risti', 'Bumil Risti', 2, true),
	('Balita Risti', 'Balita Risti', 3, true),
	('TB', 'TB', 4, true),
	('Stunting', 'Stunting', 5, true)
ON CONFLICT ("kode") DO NOTHING;
