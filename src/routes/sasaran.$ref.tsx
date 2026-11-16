import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { RoutePending } from '@/components/ui/RoutePending'
import { getSasaranDetail } from '@/lib/api/server-fns'
import { requireAuth } from '@/lib/auth/auth'
import { fmtDate } from '@/lib/utils'
import { DetailHeader, InfoPanel, Timeline } from '@/components/shared'
import { PageHeader, SectionCard, Button, StatusBadge } from '@/components/ui'

export const Route = createFileRoute('/sasaran/$ref')({
  beforeLoad: requireAuth,
  loader: async ({ params }) =>
    await getSasaranDetail({ data: { ref: params.ref } }),
  pendingComponent: () => <RoutePending>Memuat detail sasaran…</RoutePending>,
  component: SasaranDetail,
})

function SasaranDetail() {
  const navigate = useNavigate()
  const { warga: row, surveys } = Route.useLoaderData()

  if (!row) {
    return (
      <>
        <PageHeader
          title="Sasaran tidak ditemukan"
          description="Data sasaran tidak ada atau tautannya sudah tidak berlaku."
        />
        <div className="mt-3.5 rounded-[10px] border border-line bg-surface p-6 text-center">
          <p className="text-sm font-bold text-ink">Data sasaran tidak ada.</p>
          <p className="mt-1 text-xs text-muted">
            Tautan mungkin salah atau data sudah dihapus.
          </p>
          <Button
            variant="primary"
            onClick={() => navigate({ to: '/sasaran' })}
          >
            Kembali ke Data Sasaran
          </Button>
        </div>
      </>
    )
  }

  const status = surveys.length > 0 ? 'Sudah' : 'Belum'

  const note =
    status === 'Belum'
      ? {
          cls: 'border-[var(--color-status-belum-border)] bg-[var(--color-status-belum-bg)] text-[var(--color-status-belum-text)]',
          title: 'Belum melakukan pemeriksaan.',
          desc: 'Sasaran ini belum punya isian form. Jadwalkan kunjungan rumah atau input lewat form kunjungan rumah.',
        }
      : {
          cls: 'border-[var(--color-status-done-border)] bg-[var(--color-status-done-bg)] text-[var(--color-status-done-text)]',
          title: 'Sudah diperiksa.',
          desc: `${surveys.length}× isian form tercatat di database.`,
        }

  return (
    <>
      <PageHeader
        title={`Detail Sasaran`}
        // description={`${row.nama_art} — NIK ${row.nik}`}
      />

      <DetailHeader
        breadcrumb={[
          { label: 'Dashboard', href: '/' },
          { label: 'Data Sasaran', href: '/sasaran' },
          { label: row.nama_art },
        ]}
        onBack={() => navigate({ to: '/sasaran' })}
        title={row.nama_art}
        // meta={`NIK ${row.nik} · Kel. ${row.kelurahan} · ${row.jenis_kelamin}`}
      />

      {row.needsUpdate ? (
        <div className="mt-3.5 rounded-[10px] border border-warn/40 bg-warn/10 px-3.5 py-2.5 text-xs font-semibold text-warn">
          NIK sementara (bukan NIK asli) — data dari impor belum punya NIK
          valid. Perbarui NIK sebelum menyimpan kunjungan rumah untuk sasaran
          ini.
        </div>
      ) : null}

      <div
        className={`no-print mt-3.5 rounded-[10px] border p-3.5 text-xs ${note.cls}`}
      >
        <b>{note.title}</b>
        <span> {note.desc}</span>
      </div>

      <div className="mt-3.5 grid grid-cols-2 gap-3.5 max-md:grid-cols-1">
        <SectionCard title="Identitas Sasaran" sub="Data pokok dari database.">
          <InfoPanel
            columns={1}
            fields={[
              { label: 'Nama', value: row.nama_art },
              { label: 'NIK', value: row.nik },
              { label: 'Nama KK', value: row.nama_kk },
              { label: 'Kelurahan', value: `Kel. ${row.kelurahan}` },
              { label: 'Kecamatan', value: row.kecamatan },
              {
                label: 'Alamat',
                value: `${row.alamat} · RT ${row.rt}/RW ${row.rw}`,
              },
              { label: 'Tanggal lahir', value: fmtDate(row.tgl_lahir) },
            ]}
          />
        </SectionCard>

        <SectionCard
          title="Ringkasan Pemeriksaan"
          sub="Status isian form dari database."
        >
          <InfoPanel
            columns={1}
            fields={[
              {
                label: 'Status terakhir',
                value: <StatusBadge value={status} />,
              },
              { label: 'Total isian form', value: `${surveys.length}×` },
              {
                label: 'Terakhir dikunjungi',
                value: surveys[0] ? fmtDate(surveys[0].tanggal) : '—',
              },
            ]}
          />
        </SectionCard>
      </div>

      <SectionCard
        title="Catatan Kader"
        sub="Riwayat isian form dari database."
        actions={
          <Link
            to="/kegiatan"
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-line bg-surface px-[10px] py-1.5 text-xs font-bold text-ink-2 transition-colors hover:border-accent"
          >
            Laporan kunjungan rumah kader
          </Link>
        }
      >
        {surveys.length === 0 ? (
          <p className="px-1 py-6 text-center text-sm text-muted">
            Belum ada isian form tercatat untuk sasaran ini.
          </p>
        ) : (
          <Timeline
            title="Riwayat Kunjungan Rumah"
            items={surveys.map((s) => ({
              date: fmtDate(s.tanggal),
              title: 'Kunjungan Rumah — Selesai',
              description: `Petugas: ${s.petugas}.`,
              done: true,
            }))}
          />
        )}
      </SectionCard>
    </>
  )
}
