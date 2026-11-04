import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'

import { AppShell } from '@/components/layout'
import { PageHeader, SectionCard, StatCard, Select } from '@/components/ui'
import { requireAuth } from '@/lib/auth/auth'
import { fmtDate } from '@/lib/utils'
import { computePeriod } from '@/lib/dashboard/warning'
import {
  SEVERITY_META,
  SEVERITY_URUTAN,
  WARNING_TYPE_LABEL,
} from '@/components/dashboard/severity'
import { FILTER_SEMUA } from '@/lib/notifikasi/ringkasan'
import { NotifikasiList } from '@/components/notifikasi/NotifikasiList'
import { useNotifikasi } from '@/hooks/notifikasi/use-notifikasi'
import type { FilterNotifikasi } from '@/lib/notifikasi/types'

export const Route = createFileRoute('/notifikasi')({
  beforeLoad: requireAuth,
  component: Notifikasi,
})

/**
 * Halaman notifikasi — pengganti pesan WhatsApp.
 *
 * Isinya persis warning yang sama dengan kartu "Perlu Perhatian" di dashboard,
 * dibuild dari sumber yang sama (`buildWarnings`), dengan tambahan dua filter
 * yang tidak ada di dashboard: jenis warning dan tingkat keseriusan.
 *
 * Halaman ini sengaja TIDAK punya status "sudah dibaca". Sesi di aplikasi ini
 * masih milik satu profil admin hardcoded (`SESSION_PROFILE` di `constants.ts`),
 * jadi menandai "sudah dibaca" tidak akan pernah terlihat orang lain. Badge di
 * lonceng karena itu menghitung warning aktif, bukan belum dibaca.
 */
function Notifikasi() {
  const [severity, setSeverity] = useState(FILTER_SEMUA)
  const [type, setType] = useState(FILTER_SEMUA)
  const [region, setRegion] = useState(FILTER_SEMUA)

  const filter: FilterNotifikasi = { severity, type, region }
  const { data, warnings, regions, ringkasan, loading, error, reload } =
    useNotifikasi(filter)

  // Periode hanya untuk keterangan; objek stabil supaya tidak recompute tiap render.
  const period = useMemo(() => computePeriod(), [])

  const adaFilter =
    severity !== FILTER_SEMUA ||
    type !== FILTER_SEMUA ||
    region !== FILTER_SEMUA

  const handleResetFilter = () => {
    setSeverity(FILTER_SEMUA)
    setType(FILTER_SEMUA)
    setRegion(FILTER_SEMUA)
  }

  // Safe fallback agar tidak crash saat loading/error jika `data` belum tersedia
  const totalWarga = data.ringkasan.warga 
  const totalKunjungan = data.ringkasan.kunjungan 

  return (
    <AppShell>
      <PageHeader title="Notifikasi" />
      <p className="mt-1 text-xs text-muted">
        Periode {fmtDate(period.startDate)} - {fmtDate(period.endDate)} ·{' '}
        {period.daysRemaining} hari tersisa
      </p>

      {/* Metric Cards */}
      <div className="mt-4 grid grid-cols-3 gap-3 max-md:grid-cols-2">
        <StatCard
          caption="Notifikasi aktif"
          value={loading ? '...' : ringkasan.total}
          sub="dihitung ulang tiap halaman dibuka"
        />
        <StatCard
          caption="Perlu tindakan segera"
          value={loading ? '...' : ringkasan.kritis}
          sub="severity kritis"
        />
        <StatCard
          caption="Warga terpantau"
          value={loading ? '...' : totalWarga}
          sub={`${loading ? '...' : totalKunjungan} record kunjungan`}
        />
      </div>

      {/* Main Section */}
      <SectionCard
        className="mt-6"
        title="Daftar notifikasi"
        sub={
          loading
            ? 'Memuat data...'
            : `${warnings.length} notifikasi ditampilkan dari ${ringkasan.total} aktif.`
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              aria-label="Filter tingkat keseriusan"
              className="w-auto! py-1.5 text-[12px]!"
            >
              <option value={FILTER_SEMUA}>Semua tingkat</option>
              {SEVERITY_URUTAN.map((s) => (
                <option key={s} value={s}>
                  {SEVERITY_META[s].label}
                </option>
              ))}
            </Select>

            <Select
              value={type}
              onChange={(e) => setType(e.target.value)}
              aria-label="Filter jenis notifikasi"
              className="w-auto! py-1.5 text-[12px]!"
            >
              <option value={FILTER_SEMUA}>Semua jenis</option>
              {Object.entries(WARNING_TYPE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>

            <Select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              aria-label="Filter wilayah"
              className="w-auto! py-1.5 text-[12px]!"
            >
              <option value={FILTER_SEMUA}>Semua wilayah</option>
              {regions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>

            {adaFilter && (
              <button
                type="button"
                onClick={handleResetFilter}
                className="cursor-pointer text-xs font-medium text-muted hover:text-foreground"
              >
                Reset
              </button>
            )}
          </div>
        }
      >
        {error ? (
          <div className="rounded-[10px] border border-danger-border bg-danger-bg p-3 text-[13px] text-danger">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => void reload()}
              className="mt-2 cursor-pointer font-bold underline"
            >
              Coba lagi
            </button>
          </div>
        ) : (
          <NotifikasiList
            warnings={warnings}
            kosong={
              adaFilter
                ? 'Tidak ada notifikasi yang cocok dengan filter ini.'
                : 'Tidak ada notifikasi aktif. Cakupan kunjungan, jadwal, dan tindak lanjut sedang beres.'
            }
          />
        )}
      </SectionCard>
    </AppShell>
  )
}