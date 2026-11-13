# Contributing ke Dashboard-PWS

Stack: TanStack Start (React 19, Nitro, Vite 8), TanStack Router (file route), Drizzle ORM (Postgres), Tailwind CSS v4, dan Vitest.

## Quick start

```bash
pnpm install
pnpm dev               # vite dev --port 3000
pnpm test              # vitest run
pnpm lint              # eslint
pnpm format            # prettier --write . && eslint --fix
pnpm check             # tsc --noEmit && prettier --check .  (jalankan sebelum commit)
pnpm generate-routes   # tsr generate -> src/routeTree.gen.ts
pnpm build
```

Env: `DATABASE_URL` (hanya server), `SECRET_KEY` (base64, untuk JWT lewat `jose`), dan `PIN` (PIN login). Variabel berawalan `VITE_` ikut masuk bundle browser; daftar prefix ada di `envPrefix` pada `vite.config.ts`. Saat setup, salin `.env.example` ke `.env`.

Sebelum mengubah banyak file, ikuti blok Skill Loading di `AGENTS.md`.

## Peta codebase

```
src/
  routes/              Halaman. Satu file = satu URL. Setiap route dijaga requireAuth.
  components/
    ui/                Komponen generik (tombol, input, kartu), lewat barrel index.ts.
    layout/            Kerangka aplikasi: AppShell, Sidebar, Topbar, BottomNav.
    shared/            Komponen gabungan lintas fitur: DataTable, Timeline, panel.
    <fitur>/           Komponen khusus satu fitur.
  hooks/               Hook generik di root, hook khusus fitur di hooks/<fitur>/.
  lib/
    <fitur>/           Logika murni: tipe, parser, helper, store/.
    service/<fitur>/   Aturan domain murni: validasi, progres, kondisi tampil.
    server/            Query DB lintas fitur dan db.server.ts.
    server/<fitur>/    Query dan mutasi DB khusus satu fitur (*.server.ts).
    api/server-fns.ts  Satu-satunya jalur dari client ke server.
    auth/, schema/, nav/, uji/
    utils.ts, constants.ts, theme.ts, enum-values.ts, supabase-storage.ts
  providers/           AuthProvider dan ToastProvider.
  routeTree.gen.ts     Dibuat otomatis. Jangan diedit.
drizzle/               Migrasi. Lihat "Migrasi database".
scripts/               Seed, smoke test, dan cek paritas. Lihat "Scripts dan uji database".
```

Fitur yang ada: `survey`, `kunjungan-rumah`, `form-builder`, `kelola`, `petugas`, `laporan`, dan `dashboard`. Kode per fitur dikelompokkan di setiap lapisan, jadi untuk mengubah `survey`, cari `survey` di tiap lapisan yang relevan.

## Menaruh kode baru

| Folder                 | Isi                                                     | Boleh mengimpor                                      |
| ---------------------- | ------------------------------------------------------- | ---------------------------------------------------- |
| `components/<fitur>/`  | Komponen React                                          | `lib/`, `hooks/`, barrel `ui/`, `layout/`, `shared/` |
| `hooks/<fitur>/`       | Hook React                                              | `lib/`, `src/lib/api/server-fns.ts`                  |
| `lib/<fitur>/`         | Logika murni: tipe, parser, helper, reducer di `store/` | Apa saja, kecuali database dan React                 |
| `lib/service/<fitur>/` | Aturan domain murni: validasi, progres, kondisi tampil  | `lib/`                                               |
| `lib/server/<fitur>/`  | `*.server.ts`: query dan mutasi database                | `lib/server/db.server.ts`, `lib/schema/`, `lib/`     |

- Kode yang dipakai dua fitur atau lebih naik ke tingkat atas (`components/`, `hooks/`, `lib/`, atau `lib/server/`). Jangan taruh di salah satu fitur.
- Folder `lib/server/` hanya berisi `*.server.ts`.
- Kalau subfolder mulai penuh, pecah per topik, misalnya `lib/kunjungan-rumah/sasaran/` atau `lib/service/kunjungan-rumah/`.

## Aturan arsitektur

- **Routing.** File di `src/routes/` adalah route. Setelah menambah atau mengubah route, jalankan `pnpm generate-routes`. Guard tunggalnya `requireAuth()` dari `src/lib/auth/auth.ts`, yang mengembalikan `{ user }` untuk router context. Sesi tidak valid di-redirect ke `/pin`. **Tidak ada `requireAdmin`.** Semua sesi valid setara. Tabel `users` berisi daftar kader dan petugas pencatat, bukan akun. Alasannya ada di `src/lib/auth/auth.ts` dan `src/lib/server/petugas/user-registry.server.ts`.
- **Backend.** Tidak ada API route atau `server.handlers`. Semua backend berupa `createServerFn` di `src/lib/api/server-fns.ts` yang mendelegasikan ke `*.server.ts`. GET untuk membaca, POST untuk login dan mutasi. Fn yang butuh sesi memasang `.middleware([authSessionToken])`.
- **Client TIDAK BOLEH** mengimpor nilai dari `*.server.ts` atau `db.server.ts`. Impor `type` tetap boleh, karena tidak masuk bundle.
- **DB.** Definisi tabel hanya ada di `src/lib/schema/`. `src/lib/server/db.server.ts` hanya diimpor dari `*.server.ts` dan `scripts/`.
- **Auth.** Satu PIN global, dibandingkan dengan env `PIN`. Detail sesi ada di `src/lib/auth/session.server.ts`, dan TTL di `src/lib/constants.ts`. Client membaca sesi lewat `useAuth()`, tidak pernah dari localStorage.
- **Error.** Server melempar `Error` biasa dengan pesan string. Belum ada kelas error terpusat. Untuk log server, pakai `console.error`.
- **Styling.** Token Tailwind v4 ada di `src/styles.css`. Pakai `cn()` dan variant dari `src/lib/utils.ts`. Jangan tulis hex literal ad hoc. Tema gelap dan terang diatur di `src/lib/theme.ts`.

## Tes

- Logika murni ditulis sebagai `*.test.ts` di folder yang sama dengan sumbernya. `vitest.config.ts` hanya memuat `src/**/*.test.ts` dengan environment `node`.
- Komponen `.tsx` dan hook React belum punya test.
- Kode yang butuh database tidak diuji lewat vitest. Lihat "Uji terhadap database".

## Generasi domain

Baca bagian ini sebelum mengubah form kunjungan rumah. Dua generasi berjalan berdampingan, dan itu disengaja.

**Generasi-1: `kunjungan-rumah`.** UI kader, dipakai route `kunjungan-rumah.tsx` dan `kunjungan-rumah.$id.tsx`. Komponennya di `src/components/kunjungan-rumah/`, dan definisi field dibaca dari dokumen `form_versions.schema` lewat `src/lib/kunjungan-rumah/template/`. Bucket layout disimpan sebagai prefix `bucket=` pada `optionSourceKey`: `identitas`, `kolom`, `bools`, dan `baha`. Parser-nya ada di `parseBucket()` di `src/lib/server/kunjungan-rumah.server.ts`.

**Generasi-2: `survey`.** Form generik dari Form Builder untuk kegiatan Posyandu. `src/lib/server/survey/form-runtime.server.ts` menyusun definisi versi form, dan `src/components/survey/DynamicField.tsx` merender lima tipe field yang bisa ditampilkan UI kader.

**Hubungan keduanya.** Record generasi-1 bukan kode mati. Payload `jsonb` di `kunjungan_rumah_records` dipetakan ke `surveys` (header) dan `survey_entries` (satu baris per jawaban) lewat field tunggal `record_legacy` di section `penyimpanan`. Bentuk jsonb sengaja tidak diubah, supaya UI yang sudah jalan tidak perlu disentuh. Kolom header (`wargaNik`, `petugasId`, `tanggal`) tetap dibaca dari `info`, sehingga filter dashboard, sasaran, dan laporan tetap bekerja.

**Keterbatasan:** rekap per field, misalnya berapa warga dengan TD tinggi, belum bisa dijawab. Rekap seperti itu butuh `survey_entries` dengan satu baris per field. Detailnya ada di `src/lib/server/kunjungan-rumah.server.ts`.

**Form bawaan.** Aturan yang mengunci form bawaan ada di `src/lib/form-builder/kode-bawaan.ts`:

- Nama section dan field tidak bebas. Form kader membacanya, dan rename ditolak saat Build.
- Tipe field dibatasi `TIPE_KADER`: `text`, `number`, `date`, `select`, `checkbox`, plus `group` khusus `record_legacy`.
- Field di section sasaran wajib punya bucket layout. Field di section biasa tidak boleh punya `optionSourceKey`.
- `record_legacy` tidak boleh dihapus. Seluruh data kunjungan disimpan di sana.
- Untuk menambah form bawaan baru, tambahkan entri di `ATURAN_BAWAAN`. Jangan menambah cabang di dua fungsi terpisah.
- Setelah mengubah penamaan field, jalankan `pnpm db:check-parity`.

## Migrasi database

Ada tiga kanal. Jangan dicampur.

| Lokasi                        | Isi                                                           | Kapan dipakai                                                                                                                                                                 |
| ----------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `drizzle/<timestamp>_<nama>/` | Hasil `pnpm db:sql` (`migration.sql` dan `snapshot.json`)     | Perubahan skema biasa: edit `src/lib/schema/`, generate, lalu periksa `migration.sql` sebelum dipakai.                                                                        |
| `drizzle/archive/`            | Branch migrasi lama yang tidak tercatat terapan pada DB acuan | Arsip saja; jangan dipindahkan kembali ke root `drizzle/` tanpa memeriksa riwayat DB karena dapat menghidupkan konflik snapshot lama.                                         |
| `drizzle/manual/`             | File `.sql` tulisan tangan, diawali tanggal                   | Yang tidak bisa lewat `db:sql`: hapus kolom, ubah unique index, seed referensi, atau generate terblokir konflik histori. Contoh: `20261008_users-buang-role-dan-pinhash.sql`. |
| `drizzle/backup/`             | Dump `pg_dump` sebelum perubahan. Tidak di-version-control    | Sebelum migrasi destruktif. Jangan di-commit.                                                                                                                                 |

Untuk perubahan yang perlu mengisi data lama sebelum constraint baru dipasang, jalankan `pnpm db:sql`, periksa dan lengkapi `migration.sql`, lalu terapkan dengan `pnpm db:migrate`. `pnpm db:push` menyinkronkan struktur secara langsung dan tidak menjalankan backfill khusus; jangan gunakan untuk menambah kolom `NOT NULL` pada tabel berisi data.

## Scripts dan uji database

| Script                          | File                                                                               | Kapan dipakai                                                                              |
| ------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `pnpm db:seed`                  | `scripts/seed.ts`: petugas dan warga referensi                                     | Menyiapkan data awal                                                                       |
| `pnpm db:seed-uji`              | `scripts/seed-uji-coba.mts`: petugas dan warga contoh                              | Menyiapkan database uji                                                                    |
| `pnpm db:check-parity`          | `scripts/check-template-parity.mts`: penamaan field form bawaan sama dengan parser | Setelah mengubah definisi atau penamaan field form                                         |
| `pnpm db:smoke-kunjungan-rumah` | `scripts/smoke-kunjungan-rumah.mts`                                                | Setelah mengubah lapisan query kunjungan rumah                                             |
| `pnpm db:smoke-kegiatan`        | `scripts/smoke-kegiatan.mts`                                                       | Setelah mengubah lapisan query kegiatan                                                    |
| `pnpm db:set-non-warga`         | `scripts/set-warga-bentuk-non-warga.mts`                                           | Hanya database uji. Produksi: `drizzle/manual/20261003_form-builder-tanpa-warga-wajib.sql` |
| `pnpm db:push`                  | `drizzle-kit push`                                                                 | Dorong skema langsung, untuk dev                                                           |
| `pnpm db:sql`                   | `drizzle-kit generate`                                                             | Buat migration SQL                                                                         |
| `pnpm db:migrate`               | `drizzle-kit migrate`                                                              | Terapkan migration SQL yang sudah diperiksa                                                |

Skrip lain di `scripts/`: `seed-form-defaults.ts` dan `seed-reference.ts`.

### Uji terhadap database

`vitest` tidak bisa mengimpor `*.server.ts`, karena `db.server.ts` melempar error saat dimuat tanpa `DATABASE_URL`. Jalur ujinya karena itu adalah script di atas: `pnpm db:check-parity` untuk definisi form, dan kedua smoke test untuk lapisan query.

Smoke test membuat baris lalu menghapusnya sendiri di akhir, dengan NIK sintetis `90000...`. Kalau ada langkah yang gagal sebelum pembersihan, cari submission sisa dan hapus manual.

Skrip yang menulis ke database memanggil `pastikanDatabaseUji()` dari `src/lib/uji/database-uji.ts`. Fungsi itu menolak URL rusak dan database remote yang namanya tidak mengandung penanda `uji`, `trial`, `test`, `staging`, atau `dev`; host `localhost`, `127.0.0.1`, dan `::1` juga diizinkan. Penanda pada kredensial, hostname remote, atau query string tidak dihitung. Jangan menyalin regex-nya ke skrip lain. Batas yang sudah diketahui dicatat di `database-uji.ts`.

## Mau mengubah apa

| Perubahan                                  | File yang disentuh                                                                                                                                                                                                                                                                               |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tambah halaman                             | File baru `src/routes/<nama>.tsx`, entri di `NAV_ITEMS` (`src/lib/nav/nav.ts`), dan bungkus `AppShell` (atau ikuti `sasaran.tsx`). Jalankan `pnpm generate-routes`. Guard: `beforeLoad: requireAuth`.                                                                                            |
| Sidebar atau bottom nav                    | `src/lib/nav/nav.ts` (label, `Icon`, `shortLabel`), lalu `Sidebar.tsx` atau `BottomNav.tsx` untuk layout.                                                                                                                                                                                        |
| Pengambilan data dari server               | 1. Query di `src/lib/server/*.server.ts` atau `src/lib/server/<fitur>/`. 2. Expose lewat `createServerFn` di `src/lib/api/server-fns.ts` dengan `method` yang benar dan `.middleware([authSessionToken])`. 3. Panggil dari `loader` route atau hook.                                             |
| Ubah skema DB                              | `src/lib/schema/` (pilih file yang tepat), lalu `pnpm db:sql`, periksa `migration.sql`, lalu `pnpm db:push` atau migrate. Perbarui `scripts/seed*.ts` kalau terdampak.                                                                                                                           |
| Login atau sesi                            | `src/routes/pin.tsx` (UI), `isValidPin` dan `touchSession` di `src/lib/auth/session.server.ts`, TTL di `src/lib/constants.ts`, rate limit di `src/lib/auth/pin-attempt.ts`.                                                                                                                      |
| Field form kunjungan rumah                 | **Jangan hardcode.** Disunting lewat Form Builder di `/kelola`. Nama yang dikunci ada di `src/lib/form-builder/kode-bawaan.ts`. Render: `src/components/kunjungan-rumah/FieldCell.tsx`.                                                                                                          |
| Validasi dan progres kunjungan             | `src/lib/service/kunjungan-rumah/` (`validate-kunjungan-rumah.ts`, `progress.ts`, `conditional.ts`) beserta test-nya. State: `src/lib/kunjungan-rumah/store/kunjungan-rumah-reducer.ts` dan `src/lib/kunjungan-rumah/types.ts`. Submit: `src/hooks/kunjungan-rumah/use-kunjungan-rumah-form.ts`. |
| Batas unggah foto                          | `src/lib/constants.ts` (`MAX_FOTO`, `MAX_FILE_BYTES`), `src/lib/kunjungan-rumah/fotos.ts` (termasuk `compressDataUrl`), dan `src/lib/supabase-storage.ts`.                                                                                                                                       |
| Form generik dan kegiatan                  | `src/lib/server/survey/form-runtime.server.ts`, `src/components/survey/DynamicField.tsx`, `src/routes/kegiatan.tsx`, dan `src/hooks/survey/use-kegiatan.ts`.                                                                                                                                     |
| Definisi form di Form Builder              | Aturan murni: `src/lib/service/form-builder/` (`validasi.ts`, `sumber-opsi.ts`). Query dan mutasi: `src/lib/server/form-builder/` (`build.server.ts`, `form-version.server.ts`, `option-source.server.ts`). Editor: `src/components/kelola/builder/`.                                            |
| Laporan dan rekap                          | `src/routes/laporan.tsx`, `src/components/laporan/`, dan `src/lib/laporan/` (`report-filter.ts`, `rekap-kunjungan-rumah.ts`). Ekspor CSV: `downloadCsv` di `src/lib/utils.ts`.                                                                                                                   |
| Dashboard                                  | `src/routes/index.tsx`, `src/components/dashboard/KegiatanTrendChart.tsx`, `src/hooks/dashboard/use-kegiatan-trend.ts`.                                                                                                                                                                          |
| Daftar dan detail sasaran                  | `src/routes/sasaran.index.tsx`, `sasaran.$id.tsx`, dan query di `src/lib/server/sasaran.server.ts` (`querySasaranListPaged`, `querySasaranByNik`).                                                                                                                                               |
| Data kader dan petugas                     | `src/lib/server/petugas/user-registry.server.ts` (query DB), `src/lib/petugas/user-registry.ts` (tipe yang aman dibaca client), `src/lib/petugas/staff.ts`, dan `src/hooks/petugas/`.                                                                                                            |
| Konstanta (kelurahan, posyandu, prioritas) | `src/lib/constants.ts`.                                                                                                                                                                                                                                                                          |
| Komponen UI yang bisa dipakai ulang        | `src/components/ui/` (satu file per komponen, lewat barrel `index.ts`). Helper dan variant bersama taruh di `src/lib/utils.ts`, bukan inline.                                                                                                                                                    |
| Tema, warna, font                          | `src/styles.css` (`@theme`), `src/lib/theme.ts`, dan `src/components/ui/ThemeToggle.tsx`.                                                                                                                                                                                                        |
| Test baru                                  | `<folder-sumber>/<nama>.test.ts`, lalu `pnpm test`. Jangan sentuh DB atau jaringan.                                                                                                                                                                                                              |

## Konvensi

- Import memakai `@/...` untuk `src/`. Barrel dipakai untuk `components/ui`, `components/layout`, dan `components/shared`.
- Satu komponen per file. Format mengikuti Prettier (tanpa semicolon, single quote).
- Komponen React memakai PascalCase, misalnya `KunjunganRumahFormScene.tsx`. Hook dan modul non-komponen memakai kebab-case, misalnya `use-kader-aktif.ts` dan `kunjungan-rumah-reducer.ts`.
- Komentar ditulis dalam bahasa Indonesia dan menjelaskan kenapa, bukan apa.
- Jangan diedit: `src/routeTree.gen.ts`, `drizzle/*/snapshot.json`, dan isi `.output/`.

## PR checklist

1. `pnpm check` dan `pnpm test` lulus. `pnpm lint` bersih.
2. Skema berubah: migration SQL ikut di PR, dan `pnpm db:seed` sudah diuji lokal.
3. Route berubah: `pnpm generate-routes` sudah dijalankan dan guard `requireAuth` terpasang.
4. Server fn baru: `method` benar (GET untuk baca, POST untuk mutasi) dan `.middleware([authSessionToken])` terpasang.
5. Query berubah: smoke test domain terkait sudah dijalankan.
6. Field form bawaan berubah: `pnpm db:check-parity` lulus.
