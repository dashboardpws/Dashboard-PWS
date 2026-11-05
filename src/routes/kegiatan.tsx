import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useKegiatan } from '@/hooks/survey/use-kegiatan'
import { useKegiatanRecords } from '@/hooks/survey/use-kegiatan-records'
import { usePetugasOpsi } from '@/hooks/petugas/use-petugas-opsi'
import type { KegiatanRow } from '@/hooks/survey/use-kegiatan-records'
import { JENIS_KEGIATAN, KELS, POSY } from '@/lib/constants'
import { fmtDate } from '@/lib/utils'
import { useToast } from '@/providers/toast'
import { AppShell } from '@/components/layout'
import {
  DokumentasiPanel,
  HistoryPanel,
  PesertaPanel,
  SuccessPanel,
} from '@/components/shared'
import {
  FillBar,
  FormField,
  HistoryRow,
  PageHeader,
  SaveBar,
  SectionCard,
  Stepper,
  Badge,
  Button,
  ButtonLink,
  Input,
  Select,
  Textarea,
} from '@/components/ui'
import type { Step } from '@/components/ui'
import { requireAuth } from '@/lib/auth/auth'

export const Route = createFileRoute('/kegiatan')({
  beforeLoad: requireAuth,
  component: Kegiatan,
})

function Kegiatan() {
  const k = useKegiatan()
  const toast = useToast()
  const { records, loading: recordsLoading, saveRecord } = useKegiatanRecords()
  const { petugasOpsi, loading: petugasLoading } = usePetugasOpsi()
  const [saved, setSaved] = useState<KegiatanRow | null>(null)
  const [fotoErr, setFotoErr] = useState('')
  const [saving, setSaving] = useState(false)

  const n = k.peserta.length ? 3 : k.fields.nama ? 2 : 1
  const steps: Step[] = [
    { label: 'Identitas', state: n > 1 ? 'done' : 'now' },
    { label: 'Peserta', state: n > 2 ? 'done' : n === 2 ? 'now' : 'todo' },
    { label: 'Dokumentasi', state: n === 3 ? 'now' : 'todo' },
    { label: 'Simpan', state: 'todo' },
  ]

  const handleFiles = (files: File[]) => {
    const skipped = k.addFiles(files)
    if (skipped > 0) {
      setFotoErr(
        `${skipped} berkas dilewati — bukan foto, >2 MB, atau kuota 6 foto penuh.`,
      )
      toast(`${skipped} berkas dilewati (bukan foto / >2 MB / maks. 6 foto).`)
    } else {
      setFotoErr('')
    }
  }

  const handleSubmit = () => {
    const r = k.submit()
    if (!r) {
      toast('Periksa kembali isian yang wajib diisi.')
      return
    }
    setSaving(true)
    // Foto kegiatan (object-URL sementara) tidak persist — simpan peserta + caption + hitungan ke DB.
    void saveRecord({
      ...r,
      peserta: k.peserta.map((p) => ({ ...p })),
      fotoCaptions: k.fotos.map((f) => f.cap),
    })
      .then((row) => {
        setSaved(row)
        toast(`Kegiatan ${r.nama} tersimpan di database.`)
      })
      .catch(() => toast('Gagal menyimpan ke database. Coba lagi.'))
      .finally(() => setSaving(false))
  }

  const handleNext = () => {
    k.clearAll()
    setSaved(null)
    setFotoErr('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <AppShell>
      <PageHeader
        title="Kegiatan Pemberdayaan"
        description="Catat kegiatan pemberdayaan masyarakat, kehadiran peserta, dan dokumentasi foto."
      />

      <Stepper steps={steps} />
      <FillBar label="Kelengkapan form" pct={k.fillPercent} />

      <SectionCard
        title="1. Identitas Kegiatan"
        sub="Data pokok kegiatan."
        bodyClassName="grid grid-cols-2 gap-3 max-md:grid-cols-1"
      >
        <FormField
          label="Nama kegiatan"
          required
          invalid={!!k.invalid.nama}
          error="Wajib diisi."
        >
          <Input
            value={k.fields.nama}
            onChange={(e) => k.setField('nama', e.target.value)}
            placeholder="cth. Penyuluhan Gizi Balita"
            invalid={!!k.invalid.nama}
          />
        </FormField>
        <FormField
          label="Petugas"
          required
          invalid={!!k.invalid.petugas}
          error="Wajib diisi."
          hint="Dipilih dari daftar petugas. Nama dan fasilitas ikut ke database, jadi rekap bisa men-filter petugas ini."
        >
          <Select
            value={k.fields.petugas}
            onChange={(e) => k.setField('petugas', e.target.value)}
            invalid={!!k.invalid.petugas}
            disabled={petugasLoading}
          >
            <option value="">
              {petugasLoading ? 'Memuat daftar petugas…' : '— Pilih petugas —'}
            </option>
            {petugasOpsi.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nama} — {p.fasKes}
              </option>
            ))}
          </Select>
        </FormField>
        <div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">
          <FormField
            label="Tanggal"
            required
            invalid={!!k.invalid.tgl}
            error="Wajib diisi."
          >
            <Input
              type="date"
              value={k.fields.tgl}
              onChange={(e) => k.setField('tgl', e.target.value)}
              invalid={!!k.invalid.tgl}
            />
          </FormField>
          <FormField label="Jam">
            <Input
              type="time"
              value={k.fields.jam}
              onChange={(e) => k.setField('jam', e.target.value)}
            />
          </FormField>
          <FormField label="Target peserta">
            <Input
              value={k.fields.target}
              onChange={(e) => k.setField('target', e.target.value)}
              placeholder="cth. 25 ibu"
            />
          </FormField>
        </div>
      </SectionCard>

      <SectionCard
        title="2. Kelurahan & Lokasi"
        sub="Lokasi pelaksanaan."
        bodyClassName="grid grid-cols-3 gap-3 max-md:grid-cols-1"
      >
        <FormField label="Jenis kegiatan">
          <Select value={k.jenis} onChange={(e) => k.setJenis(e.target.value)}>
            {JENIS_KEGIATAN.map((j) => (
              <option key={j}>{j}</option>
            ))}
          </Select>
        </FormField>
        <FormField
          label="Kelurahan"
          required
          invalid={!!k.invalid.kel}
          error="Wajib diisi."
        >
          <Select
            value={k.fields.kel}
            onChange={(e) => k.setField('kel', e.target.value)}
            invalid={!!k.invalid.kel}
          >
            <option value="">— Pilih —</option>
            {KELS.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Posyandu">
          <Select
            value={k.fields.posy}
            onChange={(e) => k.setField('posy', e.target.value)}
          >
            <option value="">— Pilih —</option>
            {POSY.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </Select>
        </FormField>
        <FormField
          label="Lokasi"
          required
          invalid={!!k.invalid.lokasi}
          error="Wajib diisi."
        >
          <Input
            value={k.fields.lokasi}
            onChange={(e) => k.setField('lokasi', e.target.value)}
            placeholder="cth. Balai RW 02"
            invalid={!!k.invalid.lokasi}
          />
        </FormField>
        <FormField label="Deskripsi kegiatan" className="md:col-span-3">
          <Textarea
            value={k.fields.deskripsi}
            onChange={(e) => k.setField('deskripsi', e.target.value)}
            placeholder="Rencana singkat, materi, metode…"
          />
        </FormField>
      </SectionCard>

      <SectionCard
        title="3. Peserta & Kehadiran"
        sub="Tambahkan peserta kegiatan."
      >
        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-2">
            <b className="text-[13px] text-ink">Daftar Peserta</b>
            <Badge variant="ok">
              {k.hadirCount} hadir dari {k.peserta.length}
            </Badge>
          </div>
          <PesertaPanel
            participants={k.peserta}
            onAdd={k.addPeserta}
            onToggle={k.togglePeserta}
            onRemove={k.removePeserta}
          />
          {k.pesertaEmpty ? (
            <span className="text-[11px] font-semibold text-danger">
              Tambahkan minimal 1 peserta.
            </span>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard title="4. Dokumentasi" sub="Min. 3 foto kegiatan, maks. 6.">
        <DokumentasiPanel
          fotos={k.fotos}
          onAddFiles={handleFiles}
          onSetCaption={k.setCaption}
          onRemoveFoto={k.removeFoto}
        />
        {fotoErr ? (
          <span className="mt-2 block text-[11px] font-semibold text-danger">
            {fotoErr}
          </span>
        ) : null}
      </SectionCard>

      <SectionCard
        title="5. Simpan"
        actions={
          <SaveBar
            onReset={k.clearAll}
            onSubmit={handleSubmit}
            disabled={saving}
            loading={saving}
            submitLabel={saving ? 'Menyimpan…' : 'Simpan kegiatan'}
          >
            <Button variant="ghost" onClick={k.loadDemo}>
              Isi contoh
            </Button>
          </SaveBar>
        }
      >
        <span className="text-xs text-muted">
          Pastikan seluruh isian bercentang hijau sebelum menyimpan.
        </span>
      </SectionCard>

      {saved ? (
        <SuccessPanel
          title={`Kegiatan ${saved.nama} tersimpan.`}
          message="Data tercatat di database; tim dapat menambah kegiatan lainnya."
        >
          <Button variant="primary" onClick={handleNext}>
            Catat kegiatan berikutnya
          </Button>
          <ButtonLink to="/sasaran" variant="primary">
            Lihat Data Sasaran
          </ButtonLink>
        </SuccessPanel>
      ) : null}

      <SectionCard
        title="Riwayat Kegiatan"
        sub={
          recordsLoading
            ? 'Memuat dari database…'
            : 'Data tersimpan di database.'
        }
      >
        <HistoryPanel
          items={records.map((r, i) => (
            <HistoryRow key={i} layout="stack">
              <div className="flex flex-wrap items-center gap-2">
                <b>{r.nama}</b>
                <span className="text-muted">· {r.jenis}</span>
              </div>
              <span className="text-muted">
                {fmtDate(r.tgl)} {r.jam ? `pukul ${r.jam}` : ''} · {r.lokasi}
              </span>
              <span className="text-muted">
                Kel. {r.kel} {r.posy ? `· Posyandu ${r.posy}` : ''} · {r.hadir}/
                {r.total} hadir · {r.foto} foto
              </span>
            </HistoryRow>
          ))}
        />
      </SectionCard>
    </AppShell>
  )
}
