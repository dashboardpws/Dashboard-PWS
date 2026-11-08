/**
 * Layar SIMULASI pengisian di dalam Form Builder.
 *
 * Berbeda dengan `PratinjauOverlay` yang mode baca, layar ini memakai komponen
 * yang sama persis dengan halaman isi (`DynamicField`) TANPA `readOnly`, jadi
 * field benar-benar bisa diketik. Gunanya untuk admin yang formnya panjang:
 * editor menampilkan daftar field sebagai baris tree yang tersusun rapat, jadi
 * sulit dibaca sebagai satu dokumen. Di sini admin bisa membaca dan mengisi
 * form seperti bentuk yang akan dilihat petugas.
 *
 * YANG TIDAK BOLEH terjadi di layar ini
 * ------------------------------------
 * Isian simulasi TIDAK PERNAH menyentuh database. Nilai hidup di state
 * komponen dan hilang saat layar ditutup. Ini bukan bug: kalau isian simulasi
 * diam-diam ikut tersimpan, admin akan mengira data uji yang mereka ketik sudah
 * jadi data kunjungan sungguhan. Menyimpan draft tetap lewat tombol Build.
 *
 * State tetap milik layar ini, bukan workspace. Yang perlu bertahan hanyalah
 * isian selama form yang sama belum diganti; effect pemuat di bawah sudah
 * menambah baris baru dan membuang isian form lama, jadianswers dari field yang
 * sekarang punya nama lain tidak ikut terbawa.
 *
 * Field dirender tanpa nilai contoh. Contoh yang dikarang justru menutupi
 * masalah yang dicari lewat simulasi — placeholder yang tidak muat, opsi yang
 * tumpang tindih, atau label yang memotong jadi dua baris.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { RotateCcw, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { PageHeader, SectionCard } from '@/components/ui'
import { PeringatanBox } from '@/components/shared'
import {
  OverlayChip,
  OverlayFullscreen,
} from '@/components/ui/OverlayFullscreen'
import { DynamicField } from '@/components/survey/DynamicField'
import { terapkanAutofill } from '@/lib/form-builder/engine'
import type { FieldRuntime } from '@/lib/server/survey/form-runtime.server'
import type { DraftFormDocument } from '@/components/kelola/builder/types'
import { draftKeRuntime } from './draft-ke-runtime'

export interface SimulasiPreviewProps {
  isOpen: boolean
  document: DraftFormDocument | null
  onClose: () => void
}

/** Peta `clientId` field ke nilai yang diketik admin selama simulasi. */
type IsianSimulasi = Record<string, unknown>

/** Kunci storage penanda draft yang sedang disimulasikan. */
const KUNCI_SIMPANAN = 'simulasiIsianByForm'

/**
 * Isian per form, bukan satu peta global.
 *
 * Admin berpindah antara form yang berbeda dan akan membuka simulasi lagi di
 * form yang sama. Satu peta global akan mengembalikan jawaban dari form lain ke
 * field yang kebetulan punya `clientId` sama — cukup untuk bikin salah paham.
 * `storage` dibaca lazy supaya modul ini tetap bisa di-import di server.
 */
function useIsianPerForm(formVersionId: string | null): {
  isian: IsianSimulasi
  setIsian: (isian: IsianSimulasi) => void
} {
  const [isian, setIsianState] = useState<IsianSimulasi>({})

  // Muat ulang setiap ganti form. `formVersionId` sengaja jadi satu-satunya
  // dependensi: efek ini harus memberi isian form yang baru, bukan ikut
  // bereaksi ke setiap ketikan.
  useEffect(() => {
    if (!formVersionId || typeof window === 'undefined') {
      setIsianState({})
      return
    }
    try {
      const mentah = window.sessionStorage.getItem(KUNCI_SIMPANAN)
      if (!mentah) return
      const semua = JSON.parse(mentah) as Record<string, IsianSimulasi>
      setIsianState(semua[formVersionId] ?? {})
    } catch {
      // sessionStorage bisa diblokir atau isinya rusak. Simulasi tidak layak
      // gagal total hanya karena isiannya tidak bisa disimpan — isi tetap jalan.
      setIsianState({})
    }
  }, [formVersionId])

  const setIsian = useMemo(
    () => (berikut: IsianSimulasi) => {
      setIsianState(berikut)
      if (!formVersionId || typeof window === 'undefined') return
      try {
        const mentah = window.sessionStorage.getItem(KUNCI_SIMPANAN)
        const semua: Record<string, IsianSimulasi> = mentah
          ? (JSON.parse(mentah) as Record<string, IsianSimulasi>)
          : {}
        semua[formVersionId] = berikut
        window.sessionStorage.setItem(KUNCI_SIMPANAN, JSON.stringify(semua))
      } catch {
        // Sama seperti di atas: kegagalan menyimpan tidak boleh menghentikan
        // simulasi, karena nilai masih ada di state.
      }
    },
    [formVersionId],
  )

  return { isian, setIsian }
}

/**
 * Apakah satu field dianggap terisi.
 *
 * Sengaja longgar: tuple satu elemen itu terisi, string kosong bukan. Tepatnya
 * tidak penting karena angka ini hanya untuk indikator progres, bukan penentu
 * validitas — server tetap satu-satunya otoritas saat data benar-benar disimpan.
 */
function terisi(nilai: unknown): boolean {
  if (nilai === null || nilai === undefined) return false
  if (typeof nilai === 'string') return nilai.trim() !== ''
  if (Array.isArray(nilai)) return nilai.length > 0
  return true
}

export function SimulasiPreview({
  isOpen,
  document,
  onClose,
}: SimulasiPreviewProps) {
  const { isian, setIsian } = useIsianPerForm(
    isOpen ? (document?.formVersionId ?? null) : null,
  )

  const definisi = useMemo(
    () => (document ? draftKeRuntime(document) : null),
    [document],
  )

  const setNilai = useCallback(
    (clientId: string, value: unknown) => {
      setIsian({ ...isian, [clientId]: value })
    },
    [isian, setIsian],
  )

  const reset = useCallback(() => setIsian({}), [setIsian])

  // Esc dan scroll-lock ditangani OverlayFullscreen (useOverlayClose).

  const semuaField = useMemo(
    () => [
      ...(definisi?.sections.flatMap((s) => s.fields) ?? []),
      ...(definisi?.fieldYatim ?? []),
    ],
    [definisi],
  )

  const wajibTerisi = semuaField.filter(
    (f) => f.wajib && terisi(isian[f.id]),
  ).length
  const jumlahWajib = semuaField.filter((f) => f.wajib).length

  if (!isOpen) return null

  const sections = definisi?.sections ?? []
  const fieldYatim = definisi?.fieldYatim ?? []

  const barisField = (field: FieldRuntime) => (
    <div key={field.id} className="grid gap-1.5">
      <DynamicField
        field={field}
        value={isian[field.id]}
        onChange={(v) => setNilai(field.id, v)}
        onWargaDipilih={(row, nilai) => {
          const answers = { ...isian, [field.id]: nilai }
          const hasil = terapkanAutofill({
            answers,
            rules: document?.rulesAutofill ?? [],
            konteks: { wargaTerpilih: { ...row } },
            triggerFieldId: field.id,
          })
          setIsian(hasil.changed ? hasil.answersBaru : answers)
        }}
      />
    </div>
  )

  return (
    <OverlayFullscreen
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel="Simulasi pengisian form"
      headerLeft={
        <>
          <span className="text-sm font-semibold text-ink">Simulasi</span>
          <OverlayChip>Isian lokal · tidak disimpan</OverlayChip>
        </>
      }
      headerRight={
        <>
          <span className="text-xs text-muted">
            {sections.length} section · {semuaField.length} pertanyaan
            {jumlahWajib > 0
              ? ` · wajib terisi ${wajibTerisi}/${jumlahWajib}`
              : ''}
          </span>
          <Button size="sm" variant="ghost" onClick={reset}>
            <RotateCcw className="w-4 h-4" /> Kosongkan
          </Button>
          <Button size="sm" variant="default" onClick={onClose}>
            <X className="w-4 h-4" /> Tutup
          </Button>
        </>
      }
    >
      <PageHeader
        title="Simulasi pengisian"
        description="Isi form di bawah seperti yang akan dilakukan petugas, untuk membaca dan mencoba alurnya. Semua isian di layar ini hanya disimpan di tab ini dan hilang saat ditutup — tidak masuk database, dan tidak menjawab pertanyaan wajib yang kosong. Kalau mau menyimpan perubahan pertanyaan, tutup dulu layar ini lalu tekan Build."
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
            Tidak ada section aktif untuk disimulasikan. Section yang dimatikan
            tidak ikut di sini — memang tidak akan tampil saat form diisi.
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
