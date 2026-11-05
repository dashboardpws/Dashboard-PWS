import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { AppShell } from '@/components/layout/AppShell'
import { useIsMobile } from '@/hooks/use-media-query'
import { Stepper as StepperMantine } from '@mantine/core'
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
import type { KunjunganRumahSectionTemplate } from '@/lib/kunjungan-rumah/template/kunjungan-rumah-templates'
import { KeluargaInfoSection } from './KeluargaInfoSection'
import { AnggotaSection } from './AnggotaSection'
import { SanitasiSection } from './SanitasiSection'
import { SasaranListSection } from './SasaranListSection'
import { MasalahSection } from './MasalahSection'
import { HasilSection } from './HasilSection'
import { GenericSection } from './GenericSection'
import { HistorySection } from './HistorySection'

interface Props {
  /** Record yang sedang diedit. null/kosong = mode input baru. */
  record?: KunjunganRumahRecord | null
}

interface SectionBlock {
  key: string
  sections: KunjunganRumahSectionTemplate[]
}

/**
 * Kelompokkan section DB menjadi blok kartu.
 */
function buildBlocks(
  sections: KunjunganRumahSectionTemplate[],
  sasaranOrder: number,
): SectionBlock[] {
  const visible = sections
    .filter((s) => s.active && s.kind !== 'penyimpanan' && s.kind !== 'sasaran')
    .sort((a, b) => a.order - b.order)

  const blocks: SectionBlock[] = []
  let sasaranDisisipkan = false

  for (const section of visible) {
    if (
      !sasaranDisisipkan &&
      (section.order > sasaranOrder ||
        section.kind === 'masalah' ||
        section.kind === 'hasil')
    ) {
      blocks.push({ key: 'sasaran', sections: [] })
      sasaranDisisipkan = true
    }

    const key =
      section.kind === 'keluarga' ||
      section.kind === 'anggota' ||
      section.kind === 'sanitasi'
        ? 'data-keluarga'
        : section.kind === 'masalah' || section.kind === 'hasil'
          ? 'hasil'
          : `generik:${section.name}`

    const last = blocks[blocks.length - 1]
    if (last?.key === key) last.sections.push(section)
    else blocks.push({ key, sections: [section] })
  }

  if (!sasaranDisisipkan) blocks.push({ key: 'sasaran', sections: [] })
  return blocks
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
  const isMobile = useIsMobile()
  const editMode = Boolean(record)
  const [saved, setSaved] = useState<KunjunganRumahRecord | null>(null)
  const [fotoErr, setFotoErr] = useState('')
  const [mobileStep, setMobileStep] = useState(0)

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
    void handleSubmit().then((hasil) => {
      if (hasil.status === 'unchanged') {
        goCreate()
        return
      }
      if (hasil.status !== 'saved') return
      if (editMode) {
        goCreate()
        return
      }
      setSaved(hasil.record)
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

  const blocks = buildBlocks(templates.sections, templates.sasaranOrder)
  const sasaranIndex = Math.max(
    0,
    blocks.findIndex((block) => block.key === 'sasaran'),
  )
  const sasaranBlock = blocks[sasaranIndex]
  const mobileStages = [
    blocks.slice(0, sasaranIndex),
    sasaranBlock ? [sasaranBlock] : [],
    blocks.slice(sasaranIndex + 1),
  ]
  const mobileStageTitles = [
    'Data keluarga',
    'Pemeriksaan sasaran',
    'Hasil dan tindak lanjut',
    'Dokumentasi dan simpan',
  ]

  const pindahTahap = (tahap: number) => {
    setMobileStep(tahap)
    if (typeof window !== 'undefined')
      window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleReset = () => {
    reset()
    setMobileStep(0)
    setFotoErr('')
  }

  return (
    <AppShell>
      <PageHeader
        title={editMode ? 'Edit Kunjungan Rumah' : 'Kunjungan Rumah'}
      />
      {!isMobile ? <Stepper steps={steps} /> : null}
      {!isMobile ? <FillBar pct={fillPercent} /> : null}

      {isMobile ? (
        <div className="relative mt-3.5 rounded-xl border border-line bg-surface p-3.5">
          {/* Garis Progress Custom di Antara Step */}
          <div className="absolute left-8 right-10 top-7.75 h-0.5 bg-line-2">
            <div
              className="h-full bg-accent transition-all duration-300"
              style={{
                width: `${(mobileStep / (mobileStageTitles.length - 1)) * 100}%`,
              }}
            />
          </div>

          <StepperMantine
            active={mobileStep}
            onStepClick={setMobileStep}
            size="xs"
            color="var(--color-accent)"
            allowNextStepsSelect={false}
            labelPosition="bottom"
            classNames={{
              root: 'relative z-10',
              steps: 'flex-nowrap! justify-between',
              stepLabel: 'hidden',
              stepDescription:
                'text-[9px]! font-medium text-muted mt-1 text-center',
              separator: 'opacity-0', // Sembunyikan separator asli Mantine
            }}
          >
            {mobileStageTitles.map((title, index) => (
              <StepperMantine.Step
                key={title}
                label={`Langkah ${index + 1}`}
                description={title}
              />
            ))}
          </StepperMantine>
        </div>
      ) : null}

      {blocks.map((block) => {
        if (
          isMobile &&
          (mobileStep === 3 || !mobileStages[mobileStep]?.includes(block))
        )
          return null

        if (block.key === 'data-keluarga') {
          return (
            <SectionCard
              key={block.key}
              title="1. Data Keluarga & Anggota"
              sub="Informasi tempat, KK, anggota keluarga, pilih sasaran tiap anggota, dan sanitasi/lingkungan rumah."
            >
              {block.sections.map((section) => {
                if (section.kind === 'keluarga')
                  return (
                    <KeluargaInfoSection
                      key={section.name}
                      state={state}
                      templates={templates}
                      dispatch={dispatch}
                      onWargaSelected={handleWargaSelected}
                    />
                  )
                if (section.kind === 'anggota')
                  return (
                    <AnggotaSection
                      key={section.name}
                      state={state}
                      templates={templates}
                      dispatch={dispatch}
                    />
                  )
                return (
                  <SanitasiSection
                    key={section.name}
                    state={state}
                    templates={templates}
                    dispatch={dispatch}
                  />
                )
              })}
            </SectionCard>
          )
        }

        if (block.key === 'sasaran') {
          return (
            <SectionCard
              key={block.key}
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
          )
        }

        if (block.key === 'hasil') {
          return (
            <SectionCard
              key={block.key}
              title="3. Hasil, Prioritas & Tindak Lanjut"
              sub="Label prioritas program, masalah ditemukan, hasil kunjungan rumah, dan tanda tangan kader."
            >
              {block.sections.map((section) =>
                section.kind === 'masalah' ? (
                  <MasalahSection
                    key={section.name}
                    state={state}
                    templates={templates}
                    dispatch={dispatch}
                  />
                ) : (
                  <HasilSection
                    key={section.name}
                    state={state}
                    templates={templates}
                    dispatch={dispatch}
                  />
                ),
              )}
            </SectionCard>
          )
        }

        const section = block.sections[0]
        if (!section) return null
        return (
          <SectionCard
            key={block.key}
            title={section.label || section.name}
            sub={section.description ?? 'Bagian tambahan dari definisi form.'}
          >
            <GenericSection
              section={section}
              state={state}
              dispatch={dispatch}
            />
          </SectionCard>
        )
      })}

      {!isMobile || mobileStep === 3 ? (
        <>
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

          {!isMobile ? (
            <SectionCard
              title="Simpan"
              actions={
                <SaveBar
                  onReset={handleReset}
                  onSubmit={onSubmit}
                  disabled={fotoUploading || saving}
                  loading={saving}
                  submitLabel={saving ? 'Menyimpan…' : 'Simpan kunjungan rumah'}
                />
              }
            >
              <span className="text-xs text-muted">
                Pastikan seluruh isian wajib bercentang hijau sebelum menyimpan.
              </span>
            </SectionCard>
          ) : null}
        </>
      ) : null}

      {isMobile ? (
        <div className="sticky bottom-20 z-10 mt-4 flex gap-2 border-t border-line bg-canvas/95 py-3 backdrop-blur">
          {mobileStep > 0 ? (
            <Button
              variant="default"
              className="flex-1 text-sm!"
              onClick={() => pindahTahap(mobileStep - 1)}
            >
              Kembali
            </Button>
          ) : null}
          {mobileStep < 3 ? (
            <Button
              variant="primary"
              className="ml-auto flex-1 text-sm!"
              onClick={() => pindahTahap(mobileStep + 1)}
            >
              Lanjut
            </Button>
          ) : (
            <>
              <Button
                variant="default"
                className="flex-1 text-sm!"
                onClick={handleReset}
                disabled={fotoUploading || saving}
              >
                Reset
              </Button>
              <Button
                variant="primary"
                className="flex-1 text-sm!"
                onClick={onSubmit}
                disabled={fotoUploading || saving}
                loading={saving}
              >
                {saving ? 'Menyimpan…' : 'Simpan'}
              </Button>
            </>
          )}
        </div>
      ) : null}

      {saved ? (
        <SuccessPanel
          title={`Kunjungan rumah ${saved.info.namaKK || 'keluarga'} tersimpan.`}
          message={`${saved.penilaian.length} penilaian sasaran · ${saved.masalah.length} masalah tercatat. Kader dapat melanjutkan ke keluarga berikutnya.`}
        >
          <Button className="text-sm!" variant="primary" onClick={handleNext}>
            Isi keluarga berikutnya
          </Button>
          <ButtonLink className="text-sm!" to="/sasaran" variant="primary">
            Lihat Data Sasaran
          </ButtonLink>
        </SuccessPanel>
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
