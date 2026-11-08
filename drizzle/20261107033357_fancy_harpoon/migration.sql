CREATE TABLE "cron_notifikasi_terkirim" (
	"kunci" varchar(80) PRIMARY KEY,
	"hari" date NOT NULL,
	"terkirim" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
