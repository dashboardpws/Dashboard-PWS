import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'

import { useUserRegistry } from '@/hooks/petugas/use-user-registry'
import { useKunjunganRumahTemplates } from '@/hooks/kunjungan-rumah/use-kunjungan-rumah-templates'
import { AppShell } from '@/components/layout'
import { PageHeader, StatCard, Tab } from '@/components/ui'
import { requireAuth } from '@/lib/auth/auth'
import { TABS } from '@/lib/kelola/types'
import type { KelolaTab } from '@/lib/kelola/types'
import { FormBuilderSection } from '@/components/kelola/FormBuilderSection'
import { UserSection } from '@/components/kelola/UserSection'

export const Route = createFileRoute('/kelola')({
  beforeLoad: requireAuth,
  component: Kelola,
})

function Kelola() {
  const {
    pengguna,
    fasilitas,
    error: registryError,
    loading: registryLoading,
    save,
    setAktif,
  } = useUserRegistry()
  // Hook ini hanya dipakai untuk angka ringkasan di bawah. Definisi formnya
  // sendiri disunting di tab Form Builder — termasuk form kunjungan rumah,
  // yang tidak lagi punya tab sendiri.
  const {
    templates,
    error: templateError,
    loading: templateLoading,
  } = useKunjunganRumahTemplates()

  const [tab, setTab] = useState<KelolaTab>('form-builder')

  const activeFieldCount =
    templates.keluargaInfo.filter((f) => f.active).length +
    templates.anggota.filter((f) => f.active).length +
    templates.sanitasi.filter((f) => f.active).length +
    templates.masalah.filter((f) => f.active).length +
    Object.values(templates.sasaran).reduce(
      (a, s) => a + s.fields.filter((f) => f.active).length,
      0,
    )
  // Semua baris di registry adalah kader, jadi "petugas aktif" tinggal menghitung
  // yang `aktif`. Tidak ada peran yang perlu disaring: kolom `users.role` sudah
  // dihapus dari skema karena tidak pernah membatasi apa pun.
  const petugasAktif = pengguna.filter((p) => p.aktif).length

  return (
    <AppShell>
      <PageHeader
        title="Kelola Aplikasi"
      />

      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        {registryLoading && (
          <div className="pointer-events-auto flex items-center gap-3 rounded-lg bg-surface-2 px-4 py-3 text-sm text-ink-1 shadow-lg backdrop-blur transition-all duration-300 animate-in fade-in slide-in-from-bottom-3 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:slide-out-to-bottom-3">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p>Memuat daftar kader…</p>
          </div>
        )}
      
        {templateLoading && (
          <div className="pointer-events-auto flex items-center gap-3 rounded-lg bg-surface-2 px-4 py-3 text-sm text-ink-1 shadow-lg backdrop-blur transition-all duration-300 animate-in fade-in slide-in-from-bottom-3 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:slide-out-to-bottom-3">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p>Menghitung field aktif…</p>
          </div>
        )}
      
        {registryError && (
          <div className="pointer-events-auto flex items-center gap-3 rounded-lg bg-surface-2 px-4 py-3 text-sm text-destructive shadow-lg backdrop-blur transition-all duration-300 animate-in fade-in slide-in-from-bottom-3 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:slide-out-to-bottom-3">
            <p>{registryError}</p>
          </div>
        )}
      
        {templateError && (
          <div className="pointer-events-auto flex items-center gap-3 rounded-lg bg-surface-2 px-4 py-3 text-sm text-destructive shadow-lg backdrop-blur transition-all duration-300 animate-in fade-in slide-in-from-bottom-3 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:slide-out-to-bottom-3">
            <p>{templateError}</p>
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 max-md:grid-cols-1">
        <StatCard
          caption="Field Kunjungan Rumah aktif"
          value={activeFieldCount}
        />
        <StatCard caption="Petugas aktif" value={petugasAktif} />
      </div>

      <div
        role="tablist"
        aria-label="Kelola"
        className="mt-4 flex flex-wrap gap-2"
      >
        {TABS.map((t) => (
          <Tab
            key={t.key}
            active={tab === t.key}
            onClick={() => setTab(t.key)}
            role="tab"
            aria-selected={tab === t.key}
          >
            {t.label}
          </Tab>
        ))}
      </div>

      {tab === 'form-builder' ? <FormBuilderSection /> : null}

      {tab === 'staff' ? (
        <UserSection
          pengguna={pengguna}
          fasilitas={fasilitas}
          save={save}
          setAktif={setAktif}
        />
      ) : null}
    </AppShell>
  )
}
