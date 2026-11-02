import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { AppShell } from '@/components/layout/AppShell'

import { DokumentasiPanel } from '@/components/shared/DokumentasiPanel'
import { SuccessPanel } from '@/components/shared/SuccessPanel'
import { SectionCard } from '@/components/ui/SectionCard'
import { Stepper } from '@/components/ui/Stepper'
import type { Step } from '@/components/ui/Stepper'
import { FillBar } from '@/components/ui/FillBar'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { ButtonLink, SaveBar } from '@/components/ui'
import { useToast } from '@/providers/toast'
import { useKunjunganRumahForm } from '@/hooks/kunjungan-rumah/use-kunjungan-rumah-form'
import type { KunjunganRumahRecord } from '@/lib/kunjungan-rumah/types'
import { KeluargaInfoSection } from './KeluargaInfoSection'
import { AnggotaSection } from './AnggotaSection'
import { SanitasiSection } from './SanitasiSection'
import { SasaranListSection } from './SasaranListSection'
import { MasalahSection } from './MasalahSection'
import { HasilSection } from './HasilSection'
import { HistorySection } from './HistorySection'

interface Props {
  /** Record yang sedang diedit. null/kosong = mode input baru. */
  record?: KunjunganRumahRecord | null
}

export function KunjunganRumahFormScene({ record }: Props) {
  const {
    templates,
    handleWargaSelected,
    state,
    dispatch,
    records,
    recordsLoading,
    recordsError,
    fillPercent,
    bahaCount,
    stepState,
    handleSubmit,
    reset,
    removeRecord,
    addFotos,
    setFotoCaption,
    removeFoto,
    fotoUploading,
    saving,
  } = useKunjunganRumahForm({ record })
  const toast = useToast()
  const navigate = useNavigate()
  const editMode = Boolean(record)
  const [saved, setSaved] = useState<KunjunganRumahRecord | null>(null)
  const [fotoErr, setFotoErr] = useState('')

  const handleFiles = async (files: File[]) => {
    const { added, skipped } = await addFotos(files)
    if (skipped > 0) {
      const msg = `${skipped} berkas dilewati — bukan foto, >2 MB, maks. 6 foto, atau total melebihi kuota.`
      setFotoErr(added === 0 ? msg : `${added} foto ditambah. ${msg}`)
      toast(
        `${skipped} berkas dilewati (bukan foto / >2 MB / maks. 6 foto / kuota penuh).`,
      )
    } else {
      setFotoErr('')
    }
  }

  const steps: Step[] = [
    { label: 'Data Keluarga & Sasaran', state: stepState[0] ?? 'todo' },
    { label: 'Form Sasaran', state: stepState[1] ?? 'todo' },
    { label: 'Hasil & Tindak', state: stepState[2] ?? 'todo' },
  ]

  const onSubmit = () => {
    void handleSubmit().then((rec) => {
      if (rec) setSaved(rec)
    })
  }

  const goCreate = () => {
    navigate({ to: '/kunjungan-rumah' })
  }

  const handleNext = () => {
    reset()
    setSaved(null)
    setFotoErr('')
    if (typeof window !== 'undefined')
      window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = (id: string) => {
    if (
      typeof window !== 'undefined' &&
      !window.confirm(
        'Hapus kunjungan rumah ini dari database? Tindakan tidak bisa dibatalkan.',
      )
    )
      return
    void removeRecord(id)
      .then(() => {
        toast('Kunjungan rumah dihapus dari database.')
        if (editMode && id === record?.id) goCreate()
      })
      .catch(() => toast('Gagal menghapus. Coba lagi.'))
  }

  return (
    <AppShell>
      <PageHeader
        title={editMode ? 'Edit Kunjungan Rumah' : 'Kunjungan Rumah'}
      />
      <Stepper steps={steps} />
      <FillBar pct={fillPercent} />

      <SectionCard
        title="1. Data Keluarga & Anggota"
        sub="Informasi tempat, KK, anggota keluarga, pilih sasaran tiap anggota, dan sanitasi/lingkungan rumah."
      >
        <KeluargaInfoSection
          state={state}
          templates={templates}
          dispatch={dispatch}
          onWargaSelected={handleWargaSelected}
        />
        <AnggotaSection
          state={state}
          templates={templates}
          dispatch={dispatch}
        />
        <SanitasiSection
          state={state}
          templates={templates}
          dispatch={dispatch}
        />
      </SectionCard>

      <SectionCard
        title="2. Form Sasaran"
        sub="Isi identitas, hasil pemeriksaan, kondisi teramati, dan tanda bahaya sesuai Definisi Operasional."
        actions={
          <span className="text-xs text-muted">
            {state.penilaian.length} penilaian · {bahaCount} tanda bahaya
            dicentang
          </span>
        }
      >
        <SasaranListSection
          state={state}
          templates={templates}
          dispatch={dispatch}
          bahaCount={bahaCount}
        />
      </SectionCard>

      <SectionCard
        title="3. Hasil, Prioritas & Tindak Lanjut"
        sub="Label prioritas program, masalah ditemukan, hasil kunjungan rumah, dan tanda tangan kader."
      >
        <MasalahSection
          state={state}
          templates={templates}
          dispatch={dispatch}
        />
        <HasilSection state={state} templates={templates} dispatch={dispatch} />
      </SectionCard>

      <SectionCard
        title="4. Dokumentasi Kegiatan"
        sub="Foto dokumentasi kunjungan rumah — wajib minimal 1 foto, maks. 6."
      >
        <DokumentasiPanel
          fotos={state.fotos.map((f) => ({
            url: f.fileUrl ?? f.dataUrl ?? '',
            cap: f.caption,
          }))}
          onAddFiles={(files) => void handleFiles(files)}
          onSetCaption={setFotoCaption}
          onRemoveFoto={removeFoto}
          title={`Dokumentasi Kunjungan Rumah (${state.fotos.length}/6)`}
        />
        {fotoUploading ? (
          <span className="mt-2 block text-[11px] font-semibold text-muted">
            Mengompres foto…
          </span>
        ) : null}
        {fotoErr ? (
          <span className="mt-2 block text-[11px] font-semibold text-danger">
            {fotoErr}
          </span>
        ) : null}
        {state.invalid.fotos ? (
          <span className="mt-2 block text-[11px] font-semibold text-danger">
            Tambahkan minimal 1 foto dokumentasi.
          </span>
        ) : null}
      </SectionCard>

      <SectionCard
        title="Simpan"
        actions={
          <SaveBar
            onReset={reset}
            onSubmit={onSubmit}
            disabled={fotoUploading || saving}
            submitLabel="Simpan kunjungan rumah"
          />
        }
      >
        <span className="text-xs text-muted">
          Pastikan seluruh isian wajib bercentang hijau sebelum menyimpan.
        </span>
      </SectionCard>

      {saved ? (
        editMode ? (
          <SuccessPanel
            title={`Perubahan kunjungan rumah ${saved.info.namaKK || 'keluarga'} tersimpan.`}
            message={`${saved.penilaian.length} penilaian sasaran · ${saved.masalah.length} masalah tercatat.`}
          >
            <Button variant="primary" onClick={goCreate}>
              Kembali & isi kunjungan baru
            </Button>
            <ButtonLink to="/kunjungan-rumah" variant="primary">
              Lihat Riwayat
            </ButtonLink>
          </SuccessPanel>
        ) : (
          <SuccessPanel
            title={`Kunjungan rumah ${saved.info.namaKK || 'keluarga'} tersimpan.`}
            message={`${saved.penilaian.length} penilaian sasaran · ${saved.masalah.length} masalah tercatat. Kader dapat melanjutkan ke keluarga berikutnya.`}
          >
            <Button variant="primary" onClick={handleNext}>
              Isi keluarga berikutnya
            </Button>
            <ButtonLink to="/sasaran" variant="primary">
              Lihat Data Sasaran
            </ButtonLink>
          </SuccessPanel>
        )
      ) : null}

      <SectionCard
        title="Riwayat Kunjungan Rumah"
        sub={
          recordsLoading
            ? 'Memuat dari database…'
            : (recordsError ?? 'Data tersimpan di database.')
        }
      >
        <HistorySection
          records={records}
          templates={templates}
          onDelete={handleDelete}
        />
      </SectionCard>
    </AppShell>
  )
}
