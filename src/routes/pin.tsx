import { useState } from 'react'
import type { FormEvent } from 'react'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { pinLogin, getSessionToken } from '@/lib/api/server-fns'
import { APP_BRAND } from '@/lib/constants'
import { useToast } from '@/providers/toast'
import brandIcon from '@/assets/brandIcon.png'
import ThemeToggle from '@/components/ui/ThemeToggle'
import { normalkanPin } from '@/lib/utils'
import { sisaMenit } from '@/lib/auth/pin-attempt'
import { PasswordInput, Button } from '@mantine/core'

/* ALUR LOGIN
1. cek sessionToken pake beforeLoad di /laporan (form)
2. sessionToken di crosscheck ke validSessions di DB
3. kalo gk ada kredensial redirect ke pin
4. pin valid redirect ke /laporan
5. update expireTime sessionToken kalo akses /laporan
*/

export const Route = createFileRoute('/pin')({
  beforeLoad: async () => {
    try {
      await getSessionToken()
    } catch {
      return undefined
    }
    throw redirect({ to: '/' })
  },
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate()
  const toast = useToast()
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!pin.trim()) {
      setError('PIN wajib diisi.')
      return
    }
    setBusy(true)
    try {
      // expect: PIN benar → cookie sesi terpasang → pindah ke dashboard "/".
      // Dikirim sebagai string, bukan `Number(...)`: PIN dari env bisa
      // berawalan nol dan `Number` akan membuangnya, sehingga PIN itu tidak
      // akan pernah bisa dipakai login. Normalisasi ada di `isValidPin`.
      const ok = await pinLogin({ data: { pin } })
      if (!ok.ok) {
        // Dua alasan ditolak, dua pesan berbeda. Keduanya tetap menolak — yang
        // dibedakan hanya penjelasan, bukan hasilnya. Error database sengaja
        // TIDAK dibedakan: user tidak boleh bisa tahu soal infrastruktur, dan
        // pesan "Gagal masuk. Coba lagi." di `catch` di bawah sudah jujur
        // tanpa menyebut penyebabnya.
        setError(
          ok.sisaLockoutMs > 0
            ? `Terlalu banyak percobaan. Coba lagi dalam ${sisaMenit(ok.sisaLockoutMs)} menit.`
            : 'PIN salah.',
        )
        return
      }
      toast('Berhasil masuk. Selamat bekerja!')
      void navigate({ to: '/' })
    } catch {
      setError('Gagal masuk. Coba lagi.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <main>
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <img src={brandIcon} alt="Kunjungan Rumah" width={64} />
          <div>
            <h1 className="text-lg font-bold leading-tight text-ink">
              {APP_BRAND.name}
            </h1>
            <p className="text-xs font-semibold tracking-[0.22em] text-muted">
              {APP_BRAND.region}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-7 shadow-elev">
          <form onSubmit={onSubmit} className="grid gap-4" noValidate>
            <div>
              <h2 className="text-base font-bold text-ink">Masuk dengan PIN</h2>
              <p className="mt-0.5 text-xs text-muted">
                Satu-satunya gerbang dashboard. Sesi berlaku 1 jam.
              </p>
            </div>

            <PasswordInput
              autoFocus
              label="PIN"
              required
              inputMode="numeric"
              value={pin}
              onChange={(e) => {
                setPin(normalkanPin(e.target.value))
                setError(null)
              }}
              error={error}
              placeholder="••••••"
              autoComplete="off"
              maxLength={8}
              // styles prop Mantine berakhir sebagai inline style, jadi selector
              // seperti &::placeholder / &:focus-within memicu warning React.
              // Bagian yang butuh selector dipindah ke classNames (Tailwind).
              classNames={{
                input: 'border-line! focus-within:border-accent!',
                innerInput: 'placeholder:text-muted/70!',
              }}
              styles={{
                // 1. Mengubah warna label "PIN"
                label: {
                  color: 'var(--color-ink-2)', // atau 'var(--mantine-color-text)'
                  fontWeight: 500,
                },
                // 2. Mengubah warna teks di dalam field input
                innerInput: {
                  color: 'var(--color-ink)', // Warna teks saat diketik
                  caretColor: 'var(--color-ink-2)', // Warna garis vertikal penanda fokus (kursor ketik)
                },
                input: {
                  backgroundColor: 'var(--color-surface)', // atau 'var(--mantine-color-body)'
                  color: 'var(--color-ink)',
                },
                // 3. Mengubah warna ikon mata (visibility toggle)
                visibilityToggle: {
                  color: 'var(--color-ink-2)',
                  backgroundColor: 'transparent',
                },
              }}
            />

            <Button
              type="submit"
              variant="primary"
              fullWidth
              loading={busy}
              mt="xs"
            >
              Masuk
            </Button>
          </form>
        </div>
      </main>
    </div>
  )
}
