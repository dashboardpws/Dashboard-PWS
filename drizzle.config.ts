import { defineConfig } from 'drizzle-kit'
import 'dotenv/config'

export default defineConfig({
  dialect: 'postgresql',
  // File lama `./src/lib/schema.ts` sudah dihapus; definisi skemanya sekarang
  // terbagi tiga file di dalam folder. Menunjuk ke satu file yang hilang tidak akan
  // berhasil, dan glob ini otomatis ikut mengambil file baru di folder yang sama.
  schema: './src/lib/schema/*.ts',
  out: './drizzle',
  schemaFilter: ['public'],
  // Migrasi aplikasi dicatat di schema `drizzle`, bukan `public`. Filter ini
  // menjadi pagar tambahan jika tabel catatan migrasi dibuat di `public`.
  tablesFilter: ['*', '!__drizzle_migrations'],
  dbCredentials: { url: process.env.DATABASE_URL! },
})
