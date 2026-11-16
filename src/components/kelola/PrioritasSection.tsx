import { SectionCard } from '@/components/ui/SectionCard'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { useToast } from '@/providers/toast'
import { usePrioritas } from '@/hooks/prioritas/use-prioritas'
import { prioritasSistem } from '@/lib/prioritas/prioritas'

export function PrioritasSection() {
  const toast = useToast()
  const { prioritas, loading, save, setAktif } = usePrioritas()
  const tambah = () => {
    const nama = window.prompt('Nama prioritas baru')
    if (nama === null) return
    void save(null, nama)
      .then(() => toast('Prioritas tersimpan.'))
      .catch((e: unknown) =>
        toast(e instanceof Error ? e.message : 'Gagal menyimpan prioritas.'),
      )
  }
  const ubah = (kode: string, namaLama: string) => {
    const nama = window.prompt('Nama prioritas', namaLama)
    if (nama === null) return
    void save(kode, nama)
      .then(() => toast('Nama prioritas diperbarui.'))
      .catch((e: unknown) =>
        toast(e instanceof Error ? e.message : 'Gagal menyimpan prioritas.'),
      )
  }
  return (
    <SectionCard
      title="Prioritas program"
      sub="Kode yang tersimpan tetap stabil. Prioritas nonaktif tetap dipakai untuk membaca riwayat lama."
    >
      <div className="mb-3">
        <Button size="sm" variant="primary" onClick={tambah}>
          + Tambah prioritas
        </Button>
      </div>
      {loading ? (
        <p className="text-sm">Memuat prioritas…</p>
      ) : (
        <div className="grid gap-2">
          {prioritas.map((p) => {
            const sistem = prioritasSistem(p.kode)
            return (
              <div
                key={p.kode}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-3"
              >
                <div>
                  <b className="text-sm">{p.nama}</b>
                  <span className="ml-2 text-[11px] text-muted lowercase">{p.kode}</span>
                  {sistem ? (
                    <span className="ml-2 rounded bg-surface-2 px-2 py-1 text-[11px]">
                      Sistem
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge
                    variant={p.aktif ? 'on' : 'off'}
                    value={p.aktif ? 'Aktif' : 'Nonaktif'}
                  />
                  {!sistem ? (
                    <>
                      <Button size="sm" onClick={() => ubah(p.kode, p.nama)}>
                        Ubah nama
                      </Button>
                      <Button
                        size="sm"
                        onClick={() =>
                          void setAktif(p.kode, !p.aktif).catch((e: unknown) =>
                            toast(
                              e instanceof Error
                                ? e.message
                                : 'Gagal mengubah status.',
                            ),
                          )
                        }
                      >
                        {p.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </SectionCard>
  )
}
