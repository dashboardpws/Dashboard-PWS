import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Skeleton } from '@mantine/core'
import { getSasaranDetail } from '@/lib/api/server-fns'
import { requireAuth } from '@/lib/auth/auth'
import { fmtDate } from '@/lib/utils'
import { DetailHeader, InfoPanel, Timeline } from '@/components/shared'
import { PageHeader, SectionCard, Button, StatusBadge } from '@/components/ui'

export const Route = createFileRoute('/sasaran/$ref')({
  beforeLoad: requireAuth,
  loader: async ({ params }) =>
    await getSasaranDetail({ data: { ref: params.ref } }),
  pendingComponent: SasaranDetailPending,
  component: SasaranDetail,
})

function SasaranDetailPending() {
  return (
    <>
      <PageHeader title="Detail Sasaran" />
      <div className="mt-3.5 rounded-[10px] border border-line bg-surface p-4">
        <Skeleton height={12} width={220} radius="sm" />
        <Skeleton height={24} width="40%" mt={12} radius="sm" />
      </div>

      <div className="mt-3.5 grid grid-cols-2 gap-3.5 max-md:grid-cols-1">
        <SectionCard title="Identitas Sasaran" sub="Data pokok dari database.">
          <div className="grid gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="grid gap-1.5">
                <Skeleton height={10} width={90} radius="sm" />
                <Skeleton height={14} width="75%" radius="sm" />
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Ringkasan Pemeriksaan"
          sub="Status isian form dari database."
        >
          <div className="grid gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="grid gap-1.5">
                <Skeleton height={10} width={110} radius="sm" />
                <Skeleton height={14} width="55%" radius="sm" />
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Catatan Kader"
        sub="Riwayat isian form dari database."
        className="mt-3.5"
      >
        <div className="grid gap-3 py-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton circle height={14} mt={2} />
              <div className="flex-1 grid gap-1.5">
                <Skeleton height={12} width={120} radius="sm" />
                <Skeleton height={14} width="60%" radius="sm" />
                <Skeleton height={12} width="45%" radius="sm" />
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </>
  )
}

function SasaranDetail() {
  const navigate = useNavigate()
  const { warga: row, surveys, pemeriksaan } = Route.useLoaderData()

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
          <div className="mt-4 border-t border-line pt-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <b className="text-xs text-ink">Pemeriksaan KR terakhir</b>
              <span className="text-[11px] text-muted">
                {pemeriksaan.tanggal
                  ? fmtDate(pemeriksaan.tanggal)
                  : 'Belum ada'}
                {pemeriksaan.petugas ? ` · ${pemeriksaan.petugas}` : ''}
              </span>
            </div>
            {pemeriksaan.item.length === 0 ? (
              <p className="mt-2 text-xs text-muted">
                Belum ada hasil pemeriksaan sasaran KR yang cocok dengan warga
                ini.
              </p>
            ) : (
              <div className="mt-3 grid gap-3">
                {pemeriksaan.item.map((item, index) => (
                  <div
                    key={`${item.sasaran}-${index}`}
                    className="rounded-lg border border-line bg-surface-2 p-3"
                  >
                    <b className="text-xs text-ink">{item.label}</b>
                    {item.nilai.length > 0 ? (
                      <dl className="mt-2 grid gap-x-4 gap-y-2 sm:grid-cols-2">
                        {item.nilai.map((nilai) => (
                          <div key={nilai.label} className="min-w-0">
                            <dt className="text-[10px] text-muted">
                              {nilai.label}
                            </dt>
                            <dd className="break-words text-xs font-medium text-ink-2">
                              {nilai.kind === 'date'
                                ? fmtDate(nilai.value)
                                : nilai.value}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                    {item.indikator.length > 0 ? (
                      <div className="mt-2 text-[11px] text-ink-2">
                        <span className="font-semibold">Indikator: </span>
                        {item.indikator.join(', ')}
                      </div>
                    ) : null}
                    {item.tandaBahaya.length > 0 ? (
                      <div className="mt-2 text-[11px] text-danger">
                        <span className="font-semibold">Tanda bahaya: </span>
                        {item.tandaBahaya.join(', ')}
                      </div>
                    ) : null}
                    {item.prioritas.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {item.prioritas.map((prioritas) => (
                          <StatusBadge key={prioritas} value={prioritas} />
                        ))}
                      </div>
                    ) : null}
                    {item.nilai.length === 0 &&
                    item.indikator.length === 0 &&
                    item.tandaBahaya.length === 0 &&
                    item.prioritas.length === 0 ? (
                      <p className="mt-2 text-[11px] text-muted">
                        Tidak ada hasil pemeriksaan yang terisi.
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
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
