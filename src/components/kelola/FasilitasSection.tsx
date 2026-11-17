import { useState } from 'react'
import { SectionCard } from '@/components/ui/SectionCard'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/providers/toast'
import { useFasilitas } from '@/hooks/faskes/use-fasilitas'
import type { BarisFasilitas, DraftFasilitas } from '@/lib/faskes/fasilitas'

const kosong: DraftFasilitas = {
  nama: '',
  tipe: 'Posyandu',
  alamat: '',
  wilayahKerjaId: 0,
}

export function FasilitasSection({ onChanged }: { onChanged?: () => void }) {
  const toast = useToast()
  const { rows, wilayah, loading, save, remove } = useFasilitas()
  const [form, setForm] = useState<{
    id?: number
    draft: DraftFasilitas
  } | null>(null)
  const simpan = () => {
    if (!form) return
    void save(form.draft, form.id)
      .then(() => {
        setForm(null)
        onChanged?.()
        toast('Fasilitas tersimpan.')
      })
      .catch((e: unknown) =>
        toast(e instanceof Error ? e.message : 'Gagal menyimpan fasilitas.'),
      )
  }
  const edit = (row: BarisFasilitas) =>
    setForm({
      id: row.id,
      draft: {
        nama: row.nama,
        tipe: row.tipe,
        alamat: row.alamat,
        wilayahKerjaId: row.wilayahKerjaId,
      },
    })
  return (
    <SectionCard
      title="Fasilitas kesehatan"
      sub="Menghapus fasilitas yang dipakai kader akan ditolak. Data kunjungan lama tetap menyimpan nama saat dicatat."
    >
      <div className="mb-3">
        <Button
          size="sm"
          variant="primary"
          onClick={() =>
            setForm({
              draft: { ...kosong, wilayahKerjaId: wilayah[0]?.id ?? 0 },
            })
          }
        >
          + Tambah fasilitas
        </Button>
      </div>
      {loading ? (
        <p className="text-sm">Memuat fasilitas…</p>
      ) : (
        <div className="grid gap-2">
          {rows.map((f) => (
            <div
              key={f.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-3"
            >
              <div>
                <b className="text-sm">{f.nama}</b>
                <div className="text-xs text-muted">
                  {f.tipe} | {f.kelurahan} | {f.kecamatan} | {f.alamat}{' '}
                  {f.jumlahKader} kader
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => edit(f)}>
                  Ubah
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    if (
                      !window.confirm(
                        `Hapus ${f.nama}? Jawaban form generik yang menyimpan ID fasilitas dapat kehilangan label.`,
                      )
                    )
                      return
                    void remove(f.id)
                      .then(() => {
                        onChanged?.()
                        toast('Fasilitas dihapus.')
                      })
                      .catch((e: unknown) =>
                        toast(
                          e instanceof Error
                            ? e.message
                            : 'Gagal menghapus fasilitas.',
                        ),
                      )
                  }}
                >
                  Hapus
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      {form ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-surface p-4">
            <h3 className="mb-3 font-semibold">
              {form.id ? 'Ubah fasilitas' : 'Tambah fasilitas'}
            </h3>
            <div className="grid gap-3">
              <label className="grid gap-1 text-sm">
                Nama
                <input
                  className="rounded border border-line bg-surface px-3 py-2"
                  maxLength={20}
                  value={form.draft.nama}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      draft: { ...form.draft, nama: e.target.value },
                    })
                  }
                />
              </label>
              <label className="grid gap-1 text-sm">
                Jenis
                <select
                  className="rounded border border-line bg-surface px-3 py-2"
                  value={form.draft.tipe}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      draft: { ...form.draft, tipe: e.target.value },
                    })
                  }
                >
                  <option>Posyandu</option>
                  <option>Pustu</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                Wilayah kerja
                <select
                  className="rounded border border-line bg-surface px-3 py-2"
                  value={form.draft.wilayahKerjaId}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      draft: {
                        ...form.draft,
                        wilayahKerjaId: Number(e.target.value),
                      },
                    })
                  }
                >
                  <option value={0}>— Pilih —</option>
                  {wilayah.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.kelurahan}, {w.kecamatan}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                Alamat
                <textarea
                  className="rounded border border-line bg-surface px-3 py-2"
                  value={form.draft.alamat}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      draft: { ...form.draft, alamat: e.target.value },
                    })
                  }
                />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button onClick={() => setForm(null)}>Batal</Button>
              <Button variant="primary" onClick={simpan}>
                Simpan
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </SectionCard>
  )
}
