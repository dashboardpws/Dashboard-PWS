import { useMemo, useState } from 'react'
import { useToast } from '@/providers/toast'
import { DataTable, MobileRow, Td, Tr } from '@/components/shared/DataTable'
import { SectionCard } from '@/components/ui/SectionCard'
import { FormField } from '@/components/ui/FormField'
import { Toolbar } from '@/components/ui/Toolbar'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { AdminModal } from './AdminModal'
import type { BarisPengguna, OpsiFasilitas } from '@/lib/petugas/user-registry'
import type { DraftPengguna } from '@/hooks/petugas/use-user-registry'

interface Props {
  pengguna: BarisPengguna[]
  fasilitas: OpsiFasilitas[]
  /** `namaLama` = nama lama (null kalau kader baru). */
  save: (namaLama: string | null, draft: DraftPengguna) => Promise<void>
  setAktif: (nama: string, aktif: boolean) => Promise<void>
}

interface FormDlg {
  title: string
  /** Nama lama kalau sedang mengubah, supaya server tahu baris mana. */
  lama: string | null
  form: {
    nama: string
    fasKesId: string
    phone: string
    on: boolean
  }
  errs: Record<string, string>
}

/**
 * Tab "Kader" di /kelola.
 *
 * Menulis ke tabel `users`, yang isinya murni daftar kader: satu baris = satu
 * orang yang boleh dipilih sebagai petugas pencatat di Form Kunjungan Rumah dan
 * Form Kegiatan, dan sebagai daftar kader di Rekap.
 *
 * Tidak ada kolom hak akses di sini. Kolom `users.role` sudah dihapus dari
 * skema karena tidak pernah membatasi apa pun — semua sesi valid setara. Field
 * username juga tidak pernah ada: login memakai satu PIN global dari
 * environment, jadi username per-akun tidak pernah dipakai untuk masuk.
 */
export function UserSection({ pengguna, fasilitas, save, setAktif }: Props) {
  const toast = useToast()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const [dlg, setDlg] = useState<FormDlg | null>(null)

  const terfilter = useMemo(
    () =>
      pengguna.filter(
        (p) =>
          (filter === 'all' || (filter === 'on' ? p.aktif : !p.aktif)) &&
          (!q ||
            p.nama.toLowerCase().includes(q.toLowerCase()) ||
            p.fasKes.toLowerCase().includes(q.toLowerCase())),
      ),
    [pengguna, filter, q],
  )

  const setForm = (key: keyof FormDlg['form'], value: string) =>
    setDlg((d) =>
      d
        ? {
            ...d,
            form: { ...d.form, [key]: value },
            errs: { ...d.errs, [key]: '' },
          }
        : d,
    )

  const bukaDlg = (edit?: BarisPengguna) => {
    const defaultFas = fasilitas[0] ? String(fasilitas[0].id) : ''
    setDlg({
      title: edit ? 'Ubah kader' : 'Tambah kader',
      lama: edit?.nama ?? null,
      form: {
        nama: edit?.nama ?? '',
        fasKesId: edit ? String(edit.fasKesId) : defaultFas,
        phone: edit?.phone ?? '',
        on: edit?.aktif ?? true,
      },
      errs: {},
    })
  }

  const simpanDlg = () => {
    if (!dlg) return
    const nama = dlg.form.nama.trim()
    const fasKesId = Number(dlg.form.fasKesId)

    if (!nama) {
      setDlg((d) =>
        d ? { ...d, errs: { ...d.errs, nama: 'Wajib isi nama.' } } : d,
      )
      return
    }
    if (!dlg.form.fasKesId || !Number.isInteger(fasKesId)) {
      setDlg((d) =>
        d
          ? {
              ...d,
              errs: { ...d.errs, fasKesId: 'Wajib pilih fasilitas kesehatan.' },
            }
          : d,
      )
      return
    }

    void save(dlg.lama, {
      nama,
      fasKesId,
      phone: dlg.form.phone.trim(),
      on: dlg.form.on,
    })
      .then(() => {
        toast('Kader tersimpan.')
        setDlg(null)
      })
      .catch((e: unknown) =>
        toast(e instanceof Error ? e.message : 'Gagal menyimpan kader.'),
      )
  }

  const toggle = (p: BarisPengguna) => {
    const next = !p.aktif
    if (
      !next &&
      !window.confirm(
        `Nonaktifkan "${p.nama}"? Kader ini tidak akan muncul lagi sebagai pilihan petugas, tapi riwayat pencatatan tetap ada.`,
      )
    )
      return
    void setAktif(p.nama, next)
      .then(() => toast(`${p.nama} ${next ? 'diaktifkan' : 'dinonaktifkan'}.`))
      .catch((e: unknown) =>
        toast(e instanceof Error ? e.message : 'Gagal mengubah status kader.'),
      )
  }

  return (
    <>
      <SectionCard
        title="Kader"
        sub="Kader di sini yang bisa dipilih sebagai petugas pencatat. Menonaktifkan tidak menghapus riwayat pencatatan."
      >
        <Toolbar>
          <Button size="sm" variant="primary" onClick={() => bukaDlg()}>
            + Tambah kader
          </Button>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari nama atau fasilitas…"
            aria-label="Cari kader"
            className="max-w-55 max-md:max-w-none"
          />
          <Select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Filter status kader"
            className="max-w-45 max-md:max-w-none"
          >
            <option value="all">Semua status</option>
            <option value="on">Aktif</option>
            <option value="off">Nonaktif</option>
          </Select>
          <span className="ml-auto text-xs text-muted">
            {terfilter.length} dari {pengguna.length} kader
          </span>
        </Toolbar>

        <DataTable
          columns={[
            { key: 'nama', label: 'Nama' },
            { key: 'wilayah', label: 'Wilayah tugas' },
            { key: 'kontak', label: 'Kontak' },
            { key: 'status', label: 'Status' },
            { key: 'aksi', label: '' },
          ]}
          rows={terfilter}
          emptyMessage="Tidak ada kader cocok."
          renderRow={(p) => (
            <Tr key={p.id}>
              <Td>
                <div className="font-semibold text-ink">{p.nama}</div>
              </Td>
              <Td>
                Kel. {p.kel} · {p.fasKes}
              </Td>
              <Td className="whitespace-nowrap">{p.phone ?? '—'}</Td>
              <Td>
                <StatusBadge
                  variant={p.aktif ? 'on' : 'off'}
                  value={p.aktif ? 'Aktif' : 'Nonaktif'}
                />
              </Td>
              <Td className="whitespace-nowrap">
                <Button size="sm" onClick={() => bukaDlg(p)}>
                  Ubah
                </Button>{' '}
                <Button size="sm" onClick={() => toggle(p)}>
                  {p.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                </Button>
              </Td>
            </Tr>
          )}
          renderMobileRow={(p) => (
            <MobileRow key={p.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold text-ink">{p.nama}</div>
                  <div className="text-xs text-muted">
                    Kel. {p.kel} · {p.fasKes}
                  </div>
                </div>
                <StatusBadge
                  variant={p.aktif ? 'on' : 'off'}
                  value={p.aktif ? 'Aktif' : 'Nonaktif'}
                />
              </div>
              <div className="mt-1 text-[11px] text-muted">
                {p.phone ?? '—'}
              </div>
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={() => bukaDlg(p)}>
                  Ubah
                </Button>
                <Button size="sm" onClick={() => toggle(p)}>
                  {p.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                </Button>
              </div>
            </MobileRow>
          )}
        />
      </SectionCard>

      {dlg ? (
        <AdminModal
          title={dlg.title}
          onClose={() => setDlg(null)}
          onSave={simpanDlg}
        >
          <FormField
            label="Nama lengkap"
            required
            error={dlg.errs.nama}
            invalid={!!dlg.errs.nama}
            hint={
              dlg.lama
                ? undefined
                : 'Nama ini jadi kunci pencocokan saat diubah, dan dipakai untuk mencocokkan kader di rekap.'
            }
          >
            <Input
              value={dlg.form.nama}
              onChange={(e) => setForm('nama', e.target.value)}
              invalid={!!dlg.errs.nama}
              placeholder="cth. Ibu Warsini"
            />
          </FormField>

          <FormField
            label="Fasilitas kesehatan"
            required
            error={dlg.errs.fasKesId}
            invalid={!!dlg.errs.fasKesId}
            hint="Menentukan kelurahan tugas sekaligus membatasi petugas ke fasilitasnya sendiri."
          >
            <Select
              value={dlg.form.fasKesId}
              onChange={(e) => setForm('fasKesId', e.target.value)}
              invalid={!!dlg.errs.fasKesId}
            >
              {fasilitas.length === 0 ? (
                <option value="">Belum ada fasilitas</option>
              ) : null}
              {fasilitas.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nama} — Kel. {f.kel}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="No. HP">
            <Input
              value={dlg.form.phone}
              onChange={(e) => setForm('phone', e.target.value)}
              placeholder="cth. 0812xxxx"
              type="tel"
            />
          </FormField>
        </AdminModal>
      ) : null}
    </>
  )
}
