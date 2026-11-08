/**
 * Field teks yang isinya bisa diambil dari Data Sasaran.
 *
 * Mengetik memunculkan dropdown hasil pencarian; memilih satu baris mengisi
 * FIELD INI SAJA dengan kolom yang ditandai field tersebut. Field lain tidak
 * ikut berubah — itu berbeda dengan Form Kunjungan Rumah yang satu pilihan
 * mengisi banyak field sekaligus, karena form generic tidak punya satu blok
 * data warga seperti `record_legacy`.
 *
 * Saran tidak membatasi jawaban: petugas tetap boleh mengetik nama yang tidak
 * ada di Data Sasaran, dan isian seperti itu tetap bisa disimpan. Itu yang
 * membuat `resolveOpsiDinamis` untuk sumber `cari_warga` selalu mengembalikan
 * daftar kosong.
 *
 * State TIDAK di `DynamicField`: komponen itu sengaja tanpa `useState` supaya
 * `memo`-nya menahan render form yang punya ratusan field. Field yang tidak
 * mencari warga tidak akan punya watcher, debounce, dan query sama sekali.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Input, FormField } from '@/components/ui'
import { SaranWargaDropdown } from './SaranWargaDropdown'
import { cariSasaranWarga } from '@/lib/api/server-fns'
import { pesanError } from '@/lib/utils'
import type { SasaranSuggestion } from '@/lib/kunjungan-rumah/sasaran/warga-row'
import type { KolomWarga } from '@/lib/service/form-builder/sumber-opsi'

/** Panjang ketikan minimum sebelum server mencari — 3 huruf sudah cukup unik di 20 ribu baris. */
const MIN_KETIK = 3
/** Tunda pencarian supaya satu ketikan tidak jadi satu round-trip ke server. */
const DEBOUNCE_MS = 300

const BARIS_KOSONG: SasaranSuggestion[] = []

/**
 * Nama property di {@link SasaranSuggestion} untuk tiap kolom.
 *
 * Dipisah supaya nama kolom database (`nama_art`) tidak bocor ke seluruh
 * komponen: mapper ini satu-satunya tempat yang tahu kedua nama itu berbeda.
 */
const PROPERTI_KOLOM: Record<KolomWarga, 'namaArt' | 'namaKk' | 'nik'> = {
  nama_art: 'namaArt',
  nama_kk: 'namaKk',
  nik: 'nik',
}

/** Placeholder per kolom, supaya petugas tahu yang diketik boleh apa. */
const PLACEHOLDER: Record<KolomWarga, string> = {
  nama_art: 'cari nama warga…',
  nama_kk: 'cari nama kepala keluarga…',
  nik: 'cari NIK…',
}

export interface FieldCariWargaProps {
  /** Kolom yang diambil dari baris yang dipilih. */
  kolom: KolomWarga
  label: string
  /** Nilai field sekarang, sesuai `validasiNilaiField` untuk tipe `text`. */
  value: unknown
  onChange: (value: unknown) => void
  /** Petunjuk di bawah label. null kalau field tidak punya deskripsi. */
  hint?: string | null
  error?: string | null
  invalid?: boolean
  placeholder?: string
  required?: boolean
  onWargaDipilih?: (row: SasaranSuggestion, nilai: string) => void
}

export function FieldCariWarga({
  kolom,
  label,
  value,
  onChange,
  hint,
  error,
  invalid,
  placeholder,
  required,
  onWargaDipilih,
}: FieldCariWargaProps) {
  const [rows, setRows] = useState<SasaranSuggestion[]>(BARIS_KOSONG)
  const [busy, setBusy] = useState(false)
  const [errorCari, setErrorCari] = useState<string | null>(null)
  /** null = dropdown ditutup. Array kosong = dibuka tapi belum ada hasil. */
  const [terbuka, setTerbuka] = useState<SasaranSuggestion[] | null>(null)

  const teks = typeof value === 'string' ? value : ''

  /**
   * Callback refetch terakhir.
   *
   * Dipakai supaya hasil query yang sudah selesai tidak menimpa isian baru.
   * Tanpa ini, mengetik cepat lalu memilih baris bisa menulis hasil query lama
   * ke field yang isinya sudah diganti.
   */
  const requestId = useRef(0)

  useEffect(() => {
    const q = teks.trim()
    if (q.length < MIN_KETIK) {
      setTerbuka(null)
      setRows(BARIS_KOSONG)
      return
    }

    setTerbuka((prev) => prev ?? BARIS_KOSONG)
    setBusy(true)
    setErrorCari(null)
    const iniRequest = requestId.current + 1
    requestId.current = iniRequest

    const timer = setTimeout(() => {
      void cariSasaranWarga({ data: { q } })
        .then((hasil) => {
          // Query yang sudah dibatalkan (user ketik lagi) tidak boleh menulis apa pun.
          if (requestId.current !== iniRequest) return
          setRows(hasil)
          setTerbuka(hasil)
        })
        .catch((err: unknown) => {
          if (requestId.current !== iniRequest) return
          setRows(BARIS_KOSONG)
          setTerbuka(null)
          setErrorCari(pesanError(err, 'Gagal mencari warga di Data Sasaran.'))
        })
        .finally(() => {
          if (requestId.current !== iniRequest) return
          setBusy(false)
        })
    }, DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [teks])

  const pilih = useCallback(
    (row: SasaranSuggestion) => {
      requestId.current += 1
      setTerbuka(null)
      setRows(BARIS_KOSONG)
      setBusy(false)
      // Kolom yang dipilih. Untuk NIK, 8.277 dari 20.454 baris import tidak punya
      // NIK: nilainya string kosong, jadi `onChange("")` dan petugas bisa ketik
      // sendiri. Tipe barisnya sudah `string`, jadi tidak perlu penjaga null.
      const nilai = row[PROPERTI_KOLOM[kolom]]
      onChange(nilai)
      onWargaDipilih?.(row, nilai)
    },
    [kolom, onChange, onWargaDipilih],
  )

  const tutup = useCallback(() => setTerbuka(null), [])

  // [perbaikan] ref input dipakai dropdown sebagai `anchorRef` agar `mousedown`
  //   di input sendiri tidak dihitung klik luar — tanpa ini, `onFocus` tidak
  //   pernah jalan lagi karena inputnya sudah fokus.
  const anchor = useRef<HTMLInputElement>(null)
  const buka = useCallback(() => {
    if (teks.trim().length >= MIN_KETIK) setTerbuka(rows)
  }, [teks, rows])

  // [perbaikan] klik pada field menerima suggestion teratas, bukan hanya
  //   membuka dropdown — expect: ketik sebagian nama lalu klik field, isian
  //   langsung lengkap dari Data Sasaran tanpa mengetik sisa manual.
  //   Baris teratas dipakai apa adanya karena server sudah mengurutkan hasil;
  //   baris tanpa nilai untuk kolom ini dilewati supaya klik tidak menghapus
  //   ketikan.
  const klik = useCallback(() => {
    const row =
      rows.find((r) => (r[PROPERTI_KOLOM[kolom]] || '').trim() !== '') ?? null
    if (row) pilih(row)
    else buka()
  }, [rows, kolom, pilih, buka])

  return (
    <FormField
      label={label}
      required={required}
      hint={hint}
      error={error}
      invalid={invalid}
    >
      <div className="relative">
        <Input
          value={teks}
          ref={anchor}
          onChange={(e) => onChange(e.target.value)}
          onFocus={buka}
          // [perbaikan] klik membuka suggestion, bukan cuma fokus — expect: field
          //   yang sedang diketik langsung menampilkan pilihan walaupun inputnya
          //   sudah fokus dan dropdown sempat tertutup, dan menerima suggestion teratas.
          onClick={klik}
          placeholder={placeholder ?? PLACEHOLDER[kolom]}
          invalid={invalid}
          disabled={false}
          list={undefined}
          autoComplete="off"
        />
        {terbuka ? (
          <SaranWargaDropdown
            rows={terbuka}
            busy={busy}
            onPilih={pilih}
            onTutup={tutup}
            anchorRef={anchor}
            pesanKosong={errorCari ?? 'Tidak ada di Data Sasaran. Isi manual.'}
          />
        ) : null}
      </div>
    </FormField>
  )
}
