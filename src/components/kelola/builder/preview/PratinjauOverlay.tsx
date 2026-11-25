/**
 * Layar pratinjau draft di dalam Form Builder.
 *
 * Yang dirender adalah DRAFT yang sedang diedit — bukan hasil Build dan bukan
 * versi tayang. Jadi admin bisa lihat bentuk form sebelum menyimpan ke database,
 * dan perubahan terakhir selalu langsung terlihat tanpa perlu Build dulu.
 *
 * Pratinjau ini MODE BACA. Setiap field digambar dengan komponen yang sama
 * dengan halaman isi (`DynamicField`), tapi dengan `readOnly`, jadi tidak ada
 * input yang menerima ketikan dan tidak ada jawaban yang bisa terkirim. Yang
 * tidak ikut ditampilkan: blok meta pencatatan (petugas, tanggal, warga),
 * Stepper, dan FillBar — ketiganya milik alur pengisian, bukan tampilan form.
 *
 * Field bertipe `image` tampil sebagai area foto yang tidak bisa diisi di sini;
 * `file` tetap menampilkan catatan belum didukung.
 */
import { useMemo } from 'react'
import { Eye, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { PageHeader, SectionCard } from '@/components/ui'
import { PeringatanBox } from '@/components/shared'
import {
  OverlayChip,
  OverlayFullscreen,
} from '@/components/ui/OverlayFullscreen'
import { DynamicField } from '@/components/survey/DynamicField'
import type { FieldRuntime } from '@/lib/server/survey/form-runtime.server'
import type { DraftFormDocument } from '@/components/kelola/builder/types'
import { draftKeRuntime } from './draft-ke-runtime'

export interface PratinjauOverlayProps {
  isOpen: boolean
  document: DraftFormDocument | null
  onClose: () => void
}

/** `onChange` sekali, dibuat stabil supaya `memo` di `DynamicField` menahan render. */
function abaikanPerubahan(): void {}

export function PratinjauOverlay({
  isOpen,
  document,
  onClose,
}: PratinjauOverlayProps) {
  const definisi = useMemo(
    () => (document ? draftKeRuntime(document) : null),
    [document],
  )

  // Esc dan scroll-lock ditangani OverlayFullscreen (useOverlayClose).

  if (!isOpen) return null

  const sections = definisi?.sections ?? []
  const fieldYatim = definisi?.fieldYatim ?? []
  const jumlahField =
    sections.reduce((n, s) => n + s.fields.length, 0) + fieldYatim.length

  const barisField = (field: FieldRuntime) => (
    <div key={field.id} className="grid gap-1.5">
      <DynamicField
        field={field}
        value={undefined}
        onChange={abaikanPerubahan}
        readOnly
      />
    </div>
  )

  return (
    <OverlayFullscreen
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel="Pratinjau form"
      headerLeft={
        <>
          <Eye className="w-4 h-4 text-muted" />
          <span className="text-sm font-semibold text-ink">Pratinjau</span>
          <OverlayChip>Mode baca · belum di-Build</OverlayChip>
        </>
      }
      headerRight={
        <>
          <span className="text-xs text-muted">
            {sections.length} section · {jumlahField} pertanyaan
          </span>
          <Button size="sm" variant="default" onClick={onClose}>
            <X className="w-4 h-4" /> Tutup
          </Button>
        </>
      }
    >
      <PageHeader
        title="Pratinjau mode baca"
        description="Tampilan di bawah memakai komponen yang sama dengan halaman isi form, tapi isiannya dikunci. Petugas pencatat dan tanggal isian sengaja tidak ikut di sini: keduanya diisi sistem di luar form, bukan bagian dari pertanyaan yang kamu susun. Isi ini belum disimpan ke database — tekan Build dulu supaya pertanyaannya benar-benar bisa diisi petugas."
      />

      {fieldYatim.length > 0 ? (
        <PeringatanBox className="mt-3">
          {fieldYatim.length} pertanyaan tidak punya section, jadi tidak punya
          tempat di form yang akan tayang. Pindahkan ke section dulu.
        </PeringatanBox>
      ) : null}

      {sections.length === 0 ? (
        <SectionCard title="Belum ada section aktif">
          <p className="text-[12.5px] text-muted">
            Tidak ada section aktif untuk dipratinjau. Section yang dimatikan
            tidak ikut dipratinjau — memang tidak akan tampil saat form diisi.
          </p>
        </SectionCard>
      ) : null}

      {sections.map((section, index) => (
        <SectionCard
          key={section.id}
          title={
            <span>
              {index + 1}. {section.nama}
            </span>
          }
          sub={section.deskripsi}
          bodyClassName="grid gap-3.5 sm:grid-cols-2 max-md:grid-cols-1"
        >
          {section.fields.map((field) => barisField(field))}
        </SectionCard>
      ))}

      {fieldYatim.length > 0 ? (
        <SectionCard
          title="Tidak bisa tayang"
          sub="Pertanyaan ini aktif, tapi section-nya tidak ada di draft."
          bodyClassName="grid gap-3.5 sm:grid-cols-2 max-md:grid-cols-1"
        >
          {fieldYatim.map((field) => barisField(field))}
        </SectionCard>
      ) : null}
    </OverlayFullscreen>
  )
}
