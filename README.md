# Dashboard-PWS

Dipakai petugas untuk mencatat kunjungan rumah dan kegiatan Posyandu, dan mencetak laporan.

## Stack

- **TanStack Start**
- **TanStack Router**
- **Drizzle ORM**
- **Tailwind CSS v4**
- **Vitest**

## Progressive Web App

Dashboard dapat dipasang ke layar utama melalui browser yang mendukung PWA.
Service worker dipakai untuk Web Push, tetapi belum menyimpan halaman atau data
untuk penggunaan offline. Koneksi internet tetap diperlukan untuk memakai fitur
aplikasi.

## Getting started

```bash
pnpm install
cp .env.example .env
pnpm dev
```

## Perintah

| Perintah               | Fungsi                                                              |
| ---------------------- | ------------------------------------------------------------------- |
| `pnpm dev`             | Server dev di port 3000                                             |
| `pnpm build`           | Build produksi                                                      |
| `pnpm test`            | Jalankan unit test                                                  |
| `pnpm lint`            | ESLint                                                              |
| `pnpm format`          | `prettier --write .` + `eslint --fix`                               |
| `pnpm check`           | `tsc --noEmit` + `prettier --check .` — **jalankan sebelum commit** |
| `pnpm generate-routes` | Regenerate `src/routeTree.gen.ts` setelah menambah/mengubah route   |

## Environment variables

| Variabel                                                 | Wajib          | Keterangan                                                                   |
| -------------------------------------------------------- | -------------- | ---------------------------------------------------------------------------- |
| `DATABASE_URL`                                           | ya             | Koneksi Postgres. Server-only.                                               |
| `SECRET_KEY`                                             | ya             | Base64, dipakai `jose` untuk menandatangani session JWT. Server-only.        |
| `PIN`                                                    | ya             | PIN login global. Server-only.                                               |
| `CRON_SECRET`                                            | ya di produksi | Bearer untuk `/cron/notifikasi`. Tanpa nilai ini endpoint selalu 401.        |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | tidak          | Kunci Web Push. Buat dengan `npx web-push generate-vapid-keys`. Server-only. |
| `VITE_VAPID_PUBLIC_KEY`                                  | tidak          | Salinan publik `VAPID_PUBLIC_KEY`, ikut ter-bundle ke browser.               |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`              | tidak          | Upload foto dan signed URL. Bucket `foto` wajib privat. Server-only.         |

Uji cron manual:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/cron/notifikasi
```

Hanya header Bearer yang diterima; `?secret=` tidak didukung karena URL bocor ke
access log. Panggilan ulang pada hari yang sama dengan daftar peringatan yang
sama tidak mengirim push dua kali (lihat tabel `cron_notifikasi_terkirim`).

## Route

| Route                  | Halaman                                                    |
| ---------------------- | ---------------------------------------------------------- |
| `/pin`                 | Login PIN. Redirect ke `/` kalau sesi sudah ada.           |
| `/`                    | Dashboard: statistik dan tren kegiatan.                    |
| `/sasaran`             | Daftar warga sasaran, dengan filter dan ekspor CSV.        |
| `/sasaran/$id`         | Detail sasaran per NIK.                                    |
| `/kunjungan-rumah`     | Formulir kunjungan rumah baru.                             |
| `/kunjungan-rumah/$id` | Buka/ubah kunjungan rumah yang tersimpan.                  |
| `/kegiatan`            | Wizard kegiatan Posyandu.                                  |
| `/laporan`             | Laporan: kunjungan rumah, kegiatan, rekap, riwayat submit. |
| `/kelola`              | Admin: Form Builder dan daftar petugas.                    |
| `/form`                | Daftar form.                                               |
| `/isi/$formVersionId`  | Isi form hasil Form Builder.                               |

| Fitur             | Komponen                      | Logika dan server                                                                                                             |
| ----------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `survey`          | `components/survey/`          | Formulir dinamis dari Form Builder, termasuk kegiatan Posyandu. `lib/server/survey/` (`form-runtime`, `kegiatan`).            |
| `kunjungan-rumah` | `components/kunjungan-rumah/` | Formulir kunjungan rumah generasi-1: seksi, reducer, selector, validasi, progres, foto.                                       |
| `form-builder`    | `components/kelola/builder/`  | Definisi form: versi, section, field, sumber opsi, validasi, audit (`lib/service/form-builder/`, `lib/server/form-builder/`). |
| `kelola`          | `components/kelola/`          | Halaman admin: Form Builder workspace, manajemen petugas.                                                                     |
| `petugas`         | `hooks/petugas/`              | Data kader dan petugas: tabel users, opsi petugas, daftar aktif (`lib/petugas/`, `lib/server/petugas/`).                      |
| `laporan`         | `components/laporan/`         | Cetak surat laporan dan rekap kunjungan rumah (`lib/laporan/`).                                                               |
| `dashboard`       | `components/dashboard/`       | Widget dashboard: tren kegiatan.                                                                                              |

Setiap fitur dipecah per lapisan di `src/`: `components/<fitur>/`, `hooks/<fitur>/`, `lib/<fitur>/`, `lib/service/<fitur>/`, dan `lib/server/<fitur>/`.

Struktur lengkap setiap folder dan file yang harus diubah per tugas ada di [CONTRIBUTING.md](CONTRIBUTING.md).

## Database

```bash
pnpm db:push
pnpm db:sql
pnpm db:seed
```

## Dokumentasi teknis

- [TanStack Start](https://tanstack.com/start)
- [TanStack Router](https://tanstack.com/router)
- [Drizzle ORM](https://orm.drizzle.team)
- [Tailwind CSS v4](https://tailwindcss.com)
