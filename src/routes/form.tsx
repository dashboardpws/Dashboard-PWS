import { createFileRoute, Link } from '@tanstack/react-router'
import { AppShell } from '@/components/layout'
import { PageHeader, SectionCard, Badge, EmptyState } from '@/components/ui'
import { useAsyncData } from '@/hooks/use-async-data'
import { listFormulir } from '@/lib/api/server-fns'
import type { BarisFormulirTerisi } from '@/lib/server/survey/form-runtime.server'
import { requireAuth } from '@/lib/auth/auth'

// Search param di-narrow dari `unknown` ke `string`. Tanpa return type eksplisit,
// `validateSearch` membuat `jenis` jadi `{}` dan pembacaan di bawah gagal.
function opsiSearch(search: Record<string, unknown>): { jenis: string } {
  return { jenis: typeof search.jenis === 'string' ? search.jenis : '' }
}

export const Route = createFileRoute('/form')({
  beforeLoad: requireAuth,
  validateSearch: (search: Record<string, unknown>) => opsiSearch(search),
  component: DaftarFormulir,
})

function jumlah(nilai: number): number {
  const angka = Number(nilai)
  return Number.isFinite(angka) ? angka : 0
}

function DaftarFormulir() {
  const {
    data: rows,
    loading,
    error,
  } = useAsyncData(() => listFormulir(), [], [] as BarisFormulirTerisi[], {
    mapError: (err: unknown) =>
      err instanceof Error && err.message
        ? err.message
        : 'Gagal memuat daftar form.',
  })

  const { jenis } = Route.useSearch()

  const filteredRows = rows.filter((row) => {
    if (jenis === 'kunjungan') return row.subjekWargaWajib === true
    if (jenis === 'kegiatan') return row.subjekWargaWajib === false
    return true
  })

  const titleMap: Record<string, string> = {
    kunjungan: 'Form Kunjungan Rumah',
    kegiatan: 'Form Kegiatan Pemberdayaan',
    '': 'Formulir',
  }
  const descMap: Record<string, string> = {
    kunjungan:
      'Checklist kunjungan rumah. Setiap isian wajib menunjuk satu warga.',
    kegiatan:
      'Catatan kegiatan pemberdayaan. Tidak menunjuk warga per-isian; daftar peserta disimpan di dalam form.',
    '': 'Form yang bisa diisi sekarang. Daftar ini mengikuti versi yang sudah diterbitkan di Kelola.',
  }

  return (
    <AppShell>
      <PageHeader
        title={titleMap[jenis] ?? 'Formulir'}
        description={descMap[jenis] ?? 'Form yang bisa diisi sekarang.'}
      />

      {/* Penanda tur dipasang di wrapper, bukan di daftar, supaya langkah tour
          tetap punya target saat belum ada form yang diterbitkan. */}
      <div data-tour="form-list">
        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
        {loading ? (
          <p className="mt-3 text-[13px] text-muted">Memuat daftar form…</p>
        ) : null}

        {!loading && filteredRows.length === 0 ? (
          <EmptyState
            title="Belum ada form yang bisa diisi."
            className="mt-3.5"
          >
            <p>
              Form baru akan muncul di sini setelah Admin menyusun pertanyaannya
              lalu menerbitkannya di Kelola. Form yang belum diterbitkan tidak
              bisa diisi.
            </p>
          </EmptyState>
        ) : null}

        {filteredRows.length > 0 ? (
          <SectionCard
            title={`Form yang bisa diisi${jenis ? ` (${titleMap[jenis]})` : ''}`}
            sub="Pilih form untuk mulai mengisi."
          >
            <ul className="grid gap-2">
              {filteredRows.map((row) => (
                <li key={row.formVersionId}>
                  <Link
                    to="/isi/$formVersionId"
                    params={{ formVersionId: row.formVersionId }}
                    className="grid gap-1 rounded-lg border border-line bg-surface px-3 py-2.5 hover:border-accent"
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <b className="text-[13px] text-ink">{row.nama}</b>
                      <Badge variant="ok">Versi {row.version}</Badge>
                    </span>
                    {row.deskripsi ? (
                      <span className="text-[12px] text-muted">
                        {row.deskripsi}
                      </span>
                    ) : null}
                    <span className="text-[11px] text-muted">
                      {jumlah(row.jumlahSection)} section ·{' '}
                      {jumlah(row.jumlahField)} pertanyaan
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </SectionCard>
        ) : null}
      </div>
    </AppShell>
  )
}
