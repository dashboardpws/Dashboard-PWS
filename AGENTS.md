<!-- intent-skills:start -->

## Skill Loading

Before editing files for a substantial task:

- Run `npx @tanstack/intent@latest list` from the workspace root to see available local skills.
- If a listed skill matches the task, run `npx @tanstack/intent@latest load <package>#<skill>` before changing files.
- Use the loaded `SKILL.md` guidance while making the change.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.

<!-- intent-skills:end -->

## Project

Dashboard PWS: pencatatan kunjungan rumah dan kegiatan Posyandu. TanStack Start + TanStack Router file routes + Drizzle/Postgres + Tailwind v4 + Vitest.

**Baca `CONTRIBUTING.md` sebelum edit besar.** Isinya peta codebase, aturan arsitektur, tabel "Mau mengubah apa"; `README.md` untuk setup dan overview route.

Pastikan branch yang gunakana adalah branch main dengan commit terbaru dari [github repo](https://github.com/dashboardpws/Dashboard-PWS)

### Note

Dokumen ini berfungsi sebagai arahan untuk kamu sebagai AI agent. Anggap dokumen ini sebagai "default setting" dan bukan "aturan keras". Prefrensi developer boleh dan bisa mengabaikan arahan yang ada di dokumen ini

Gunakan prinsip "yagni" dan "measure twice cut once" ketika mengerjakan projek ini, usahakan kode yang ditulis adalah kode yang simpel dan tidak "overengineered"

Perubahan yang kamu lakukan harus bersifat fokus, dan tidak mengubah sesuatu diluar scope perintah awal. Jika kamu harus keluar dari scope, konfirmasi kepada developer

### Glossary

- **projek**: Dashboard PWS, codebase yang kamu kerjakan sekarang
- **admin / user**: end user dari projek ini, biasanya kader yang tidak mahir teknologi
- **aku/saya/me/i/developer**: orang yang mengerjakan projek ini. Mereka mengerjakan projek ini dengan bahasa yang berbeda, respon dengan bahasa yang aku gunakan
- **client**: hardware yang akan menjalankan web ini, biasanya Handphone

## Gate sebelum commit

```bash
pnpm check   # tsc --noEmit && prettier --check .
pnpm test    # vitest run
pnpm lint    # eslint
```

Baseline saat ini: `tsc` exit 0, `eslint` 0 problem, dan 635 test lulus dari 43 file. Tidak ada test yang gagal dan tidak ada file test yang gagal dimuat. Baseline ini ditegakkan CI di `.github/workflows/quality.yml`; jangan turunkan tanpa alasan tertulis.

## Aturan yang paling sering dilanggar

- **Route.** File di `src/routes/` adalah route. Guard tunggalnya `requireAuth` dari `src/lib/auth/auth.ts`. **Tidak ada `requireAdmin`.** Semua sesi valid setara. Setelah menambah atau mengubah route, jalankan `pnpm generate-routes`. Jangan edit `src/routeTree.gen.ts` secara manual.
- **Server.** Tidak ada API route terpisah. Semua backend berupa `createServerFn` di `src/lib/api/server-fns.ts` (GET untuk baca, POST untuk mutasi, plus `.middleware([authSessionToken])`) yang mendelegasikan ke `*.server.ts`. Client tidak pernah mengimpor `db.server.ts` atau `*.server.ts` langsung.
- **DB.** Definisi tabel hanya ada di `src/lib/schema/` (tiga file: `schema.ts`, `data-import.ts`, `type-enum.ts`). Ubah skema di sana, lalu jalankan `pnpm db:sql`, lalu periksa `migration.sql` hasil generate. Jangan pernah manipulasi / modifikasi database dengan menulis file `.sql` secara manual, database dan drizzle harus sinkron.
- **Form bawaan.** Field form kunjungan rumah tidak bebas dinamai. Nama section, nama field, tipe field, dan bucket layout dikunci di `src/lib/form-builder/kode-bawaan.ts`. Mengubahnya bisa membuat form kader gagal render. Jalankan `pnpm db:check-parity` kalau menyentuh penamaan field.
- **Dua generasi domain.** Fitur `kunjungan-rumah` dan `survey` berjalan berdampingan di tiap lapisan `src/`. Baca bagian "Generasi domain" di `CONTRIBUTING.md` sebelum mengedit form kunjungan rumah. Jangan anggap salah satunya kode mati.
- **Test.** Logika murni, `*.test.ts` di folder yang sama dengan sumbernya, tanpa DB atau jaringan. `vitest.config.ts` hanya meng-include `*.test.ts` dengan `environment: node`. Komponen `.tsx` dan hook React belum punya test. Jangan tulis test yang butuh DOM sebelum config itu diubah.
- **Test yang butuh database.** Jangan tulis test untuk kode ini. `*.server.ts` mengimpor `db.server.ts`, yang melempar error saat dimuat tanpa `DATABASE_URL`. Jalur ujinya smoke test (`pnpm db:smoke-*`) dan `pnpm db:check-parity`. Peta cakupannya ada di `CONTRIBUTING.md`.
- **Penjaga database uji.** Skrip yang menulis ke DB wajib memanggil `pastikanDatabaseUji()` dari `src/lib/uji/database-uji.ts`. Jangan salin regex-nya sendiri.

## Gaya

- Import `@/...`. Barrel untuk `components/ui`, `components/layout`, dan `components/shared`.
- Prettier: tanpa semicolon, single quote.
- Komentar bahasa Indonesia, menjelaskan kenapa, bukan apa. Repo ini sengaja memakai komentar dokumentatif yang panjang. Ikuti gaya itu.
- Tailwind: pakai token dari `src/styles.css`, serta `cn()` dan variant di `src/lib/utils.ts`. Jangan tulis hex literal ad hoc.
