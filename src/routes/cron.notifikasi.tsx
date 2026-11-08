/**
 * Endpoint cron pengiriman notifikasi.
 *
 * Satu-satunya server route di repo ini, dan sengaja begitu: cron Vercel hanya
 * bisa memanggil URL, sedangkan `createServerFn` hidup di protokol RPC yang
 * butuh konteks router. Handler ini tetap tipis - logikanya di `cron.server.ts`.
 *
 * Kenapa handler, bukan loader: loader yang melempar dirender jadi halaman
 * error SSR (500), padahal pemanggilnya mesin cron, bukan browser. Dengan
 * handler, secret salah dibalas 401 JSON bersih, dan hasilnya selalu JSON -
 * tidak ada HTML yang sia-sia dirender untuk setiap hit cron.
 *
 * Secret dibaca HANYA dari header `Authorization: Bearer <CRON_SECRET>`
 * (cara Vercel). Query string `?secret=` sengaja tidak didukung: URL ikut
 * tercatat di access log, proxy, dan Referer. Uji manual memakai curl dengan
 * header yang sama. Dijadwalkan di `vercel.json`; jadwal Vercel memakai UTC,
 * jadi `0 7 * * *` = 14.00 WIB.
 *
 * GET tidak bisa diganti POST: jadwal Vercel hanya memanggil GET. Efek samping
 * tetap aman karena tanpa header Bearer yang benar handler menolak sebelum
 * menyentuh data. Retry dan prefetch tidak menggandakan push karena pengiriman
 * diklaim lewat kunci idempotensi di `cron.server.ts`.
 */

import { createFileRoute } from '@tanstack/react-router'
import {
  jalankanCronNotifikasi,
  secretCronCocok,
} from '@/lib/server/notifikasi/cron.server'

export const Route = createFileRoute('/cron/notifikasi')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!secretCronCocok(request)) {
          return Response.json({ error: 'secret tidak valid' }, { status: 401 })
        }
        const hasil = await jalankanCronNotifikasi()
        return Response.json(hasil)
      },
    },
  },
})
