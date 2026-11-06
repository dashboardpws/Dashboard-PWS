/**
 * Render SATU field runtime berdasarkan `field.tipe`.
 *
 * Tidak ada nama field, `forms.kode`, atau teks pertanyaan yang ditulis di sini.
 * Label, placeholder, deskripsi, flag wajib, daftar opsi, dan jumlah kolom group
 * semuanya dibaca dari `FieldRuntime` yang dikirim
 * `form-runtime.server.ts` (lihat `muatDefinisiRuntime`). Form baru yang dibuat
 * admin langsung tampil tanpa perubahan kode.
 *
 * TWO SOURCE OF TRUTH, DAN INI SENGAJA
 * -----------------------------------
 * Bentuk nilai yang dikirim ke server dijaga `validasiNilaiField` di
 * `src/lib/service/form-builder/validasi.ts`. Komponen ini WAJIB
 * mengikuti bentuk itu, karena kolom `survey_entries.value` bertipe jsonb dan
 * bentuk yang salah tidak ditolak database — hanya ditolak server, dengan pesan
 * yang baru dilihat petugas setelah satu putaran kirim ulang. Konkretnya:
 *   - `number` mengirim number atau null. Input kosong jadi `null`, bukan `NaN`
 *     dan bukan `""`; keduanya ditolak `validasiNilaiField` untuk tipe number.
 *   - `date`/`time` mengirim string `YYYY-MM-DD` / `HH:MM` atau null.
 *   - `checkbox` mengirim `string[]`, termasuk array kosong kalau tidak ada
 *     satu pun yang dicentang (itu sah, bukan error).
 *   - `group` mengirim array of object datar `{ kolom1, kolom2, ... }` — bentuk
 *     yang diterima `validasiNilaiGroup`. Selnya teks, angka, atau boolean.
 *   - `image`/`file` TIDAK mengirim apa pun. Belum ada upload di fase ini dan
 *     `simpanFormulir` menolak jawaban tidak kosong untuk kedua tipe itu.
 *
 * Opsi dibaca dari `opsiDinamis` kalau tidak null, kalau tidak dari `opsi` yang
 * `aktif !== false`. Urutan dan sumbernya sama persis dengan `opsiSah()` di
 * service server, supaya pilihan yang dirender dan pilihan yang diterima tidak
 * bisa berbeda.
 *
 * Penandaan wajib di sini murni UX. Server yang jadi otoritas; komponen ini
 * tidak pernah menahan submit.
 */
import { memo, useCallback } from 'react'
import {
  Button,
  Checkbox,
  Input,
  RadioCard,
  Select,
  Textarea,
  FormField,
} from '@/components/ui'
import { MAX_BARIS_GROUP } from '@/lib/service/form-builder/validasi'
import { FieldCariWarga } from './FieldCariWarga'
import type { FieldRuntime } from '@/lib/server/survey/form-runtime.server'
import type { SasaranSuggestion } from '@/lib/kunjungan-rumah/sasaran/warga-row'
import { cn } from '@/lib/utils'
import { daftarTeks, teksNilai } from '@/lib/survey/format-jawaban'

/**
 * Id jangkar satu field, dipakai `use-form-runtime` untuk menggulir ke field
 * wajib pertama yang masih kosong. Berisi `fieldId` dari server, bukan nama
 * field, jadi tetap unik walau nama field berubah.
 */
export function fieldAnchorId(fieldId: string): string {
  return `field-${fieldId}`
}

export interface DynamicFieldProps {
  field: FieldRuntime
  /** Nilai terakhir di state hook; bentuknya sudah mengikuti `validasiNilaiField`. */
  value: unknown
  onChange: (value: unknown) => void
  /** Tandai field wajib yang kosong. UX saja — server yang menolak. */
  invalid?: boolean
  /** Jalankan rule lintas field setelah suggestion warga dipilih. */
  onWargaDipilih?: (row: SasaranSuggestion) => void
  /**
   * Tampilkan bentuk field tanpa bisa diisi. Dipakai pratinjau di Form Builder:
   * field digambar persis seperti di halaman isi, tapi tidak menerima ketikan
   * dan tidak punya aksi tambah/hapus baris.
   */
  readOnly?: boolean
}

/** Satu opsi siap render. Label jatuh ke `value` kalau admin tidak memberi label. */
interface OpsiTampil {
  value: string
  label: string
}

/**
 * Opsi yang boleh dipilih field ini.
 *
 * `opsiDinamis !== null` berarti opsinya dibaca dari tabel lain saat render
 * (mis. daftar petugas dari `users`), jadi tidak punya kolom `aktif` dan semua
 * barisnya dianggap aktif — sama seperti `opsiSah()` di service server.
 */
function opsiTampil(field: FieldRuntime): OpsiTampil[] {
  if (field.opsiDinamis !== null) {
    return field.opsiDinamis.map((o) => ({ value: o.value, label: o.label }))
  }
  return field.opsi
    .filter((o) => o.aktif !== false)
    .map((o) => ({ value: o.value, label: o.label ?? o.value }))
}

/** `number` saja yang boleh jadi isi input number; selain itu tampil kosong. */
function angkaNilai(value: unknown): number | '' {
  return typeof value === 'number' && Number.isFinite(value) ? value : ''
}

/**
 * Jumlah kolom group. `jumlahKolom` nullable di database, dan baris hasil
 * seeder boleh punya `null` untuk field `group`, jadi nilai itu dipetakan ke
 * satu kolom daripada membiarkan render gagal. Bentuk nilainya tetap sah untuk
 * `validasiNilaiGroup`, yang memang tidak memeriksa jumlah kolom.
 */
function jumlahKolom(field: FieldRuntime): number {
  const n = field.jumlahKolom
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 1) return 1
  return n
}

/** Nama sel group. Kunci datar supaya bentuknya persis yang diterima server. */
function kunciKolom(urut: number): string {
  return `kolom${urut}`
}

/** Satu baris group: object datar dengan kunci `kolom1..kolomN`. */
type BarisGroup = Record<string, string>

function barisGroup(value: unknown): BarisGroup[] {
  if (!Array.isArray(value)) return []
  const keluar: BarisGroup[] = []
  for (const item of value) {
    if (typeof item !== 'object' || item === null || Array.isArray(item))
      continue
    const baris: BarisGroup = {}
    for (const [kunci, isi] of Object.entries(
      item as Record<string, unknown>,
    )) {
      if (typeof isi === 'string') baris[kunci] = isi
    }
    keluar.push(baris)
  }
  return keluar
}

/**
 * Label + helper + error untuk tipe yang punya BANYAK input di dalam satu
 * field (radio, checkbox, group).
 *
 * `FormField` merender elemen `<label>`, dan `<label>` tidak boleh berisi
 * `<label>` lain — `RadioCard` memang sebuah `<label>`. Jadi bentuk label untuk
 * tipe ini ditulis manual dengan class yang sama seperti `FormField`, bukan
 * memakai komponen itu.
 */
function LabelBlok(props: {
  label: string
  required: boolean
  hint?: string | null
  error?: string | null
  invalid?: boolean
  children: React.ReactNode
}) {
  const { label, required, hint, error, invalid, children } = props
  return (
    <div className="grid gap-1.5">
      <span className="text-xs font-semibold text-ink">
        {label}
        {required ? <span className="text-danger"> *</span> : null}
      </span>
      {children}
      {hint ? (
        <span className="text-[11px] font-normal text-muted">{hint}</span>
      ) : null}
      {error ? (
        <span
          role="alert"
          className={cn(
            'text-[11px] font-semibold text-danger',
            !invalid && 'hidden',
          )}
        >
          {error}
        </span>
      ) : null}
    </div>
  )
}

/**
 * Satu kalimat untuk sumber opsi dinamis yang tidak dikenali.
 *
 * Dipisah dari komponen supaya select, radio, dan checkbox memberi pesan yang
 * sama persis — dan supaya teksnya tidak ditulis ulang jadi di tiga tempat.
 */
const pesanSumberTidakDikenali =
  'Sumber pilihan untuk pertanyaan ini tidak dikenali atau kosong, jadi daftar jawabannya tidak bisa ditampilkan. Perbaiki di Kelola.'

/** Peringatan sumber opsi dinamis yang tidak dikenali, bukan dropdown kosong. */
function PeringatanOpsi({ pesan }: { pesan: string }) {
  return (
    <p className="rounded-lg border border-danger-border bg-danger-soft px-3 py-2 text-[11px] font-semibold text-danger">
      {pesan}
    </p>
  )
}

/**
 * Field bertipe pilihan yang tidak punya satu pun opsi aktif.
 *
 * Kasus ini nyata di data tayang: sebagian field hasil seeding Form Kunjungan
 * Rumah punya `opsi` kosong. Officer perlu tahu pertanyaannya tidak bisa
 * dijawab, dan itu masalah di Kelola, bukan di layar ini. `validasiNilaiOpsiTerpilih`
 * tetap menerima jawaban kosong untuk field seperti ini, jadi catatan ini tidak
 * memblokir penyimpanan.
 */
function CatatanOpsiKosong() {
  return (
    <p className="rounded-lg border border-dashed border-line bg-surface-2 px-3 py-2 text-[11px] text-muted">
      Belum ada pilihan jawaban untuk pertanyaan ini. Admin perlu menambahkannya
      di Kelola.
    </p>
  )
}

/** Catatan untuk `image`/`file`: tampil, tapi tidak bisa diisi. */
function CatatanLampiran() {
  return (
    <p className="rounded-lg border border-dashed border-line bg-surface-2 px-3 py-2.5 text-[11px] text-muted">
      Lampiran belum didukung. Isian form ini belum bisa menyertakan foto atau
      berkas, jadi field ini dilewati dan tidak ikut tersimpan.
    </p>
  )
}

/**
 * Id `<datalist>` untuk saran field ini. Berisi `fieldId`, jadi tetap unik
 * walau label pertanyaan berubah.
 */
export function saranDatalistId(fieldId: string): string {
  return `saran-${fieldId}`
}

function DynamicFieldImpl({
  field,
  value,
  onChange,
  invalid = false,
  onWargaDipilih,
  readOnly = false,
}: DynamicFieldProps) {
  const placeholder = field.placeholder ?? undefined
  const hint = field.deskripsi
  const error = invalid ? 'Wajib diisi.' : null

  // --- number ---------------------------------------------------------------
  // Input kosong harus jadi `null`. `NaN` dan `""` sama-sama ditolak
  // `validasiNilaiField` untuk tipe number, dan `Number("")` justru 0.
  const onNumber = useCallback(
    (raw: string) => {
      if (raw.trim() === '') {
        onChange(null)
        return
      }
      const angka = Number(raw)
      onChange(Number.isFinite(angka) ? angka : null)
    },
    [onChange],
  )

  // --- select ---------------------------------------------------------------
  const onSelect = useCallback(
    (raw: string) => onChange(raw === '' ? null : raw),
    [onChange],
  )

  // --- checkbox -------------------------------------------------------------
  const onCheckbox = useCallback(
    (opsi: string, dicentang: boolean) => {
      const sekarang = daftarTeks(value)
      const berikut = dicentang
        ? [...sekarang, opsi]
        : sekarang.filter((v) => v !== opsi)
      onChange(berikut)
    },
    [onChange, value],
  )

  // --- group ----------------------------------------------------------------
  const kolom = jumlahKolom(field)
  const baris = barisGroup(value)
  const ubahBaris = useCallback(
    (barisKe: number, kunci: string, isi: string) => {
      const berikut = baris.map((b, i) =>
        i === barisKe ? { ...b, [kunci]: isi } : b,
      )
      onChange(berikut)
    },
    [baris, onChange],
  )
  const tambahBaris = useCallback(() => {
    const kosong: BarisGroup = {}
    for (let i = 1; i <= kolom; i += 1) kosong[kunciKolom(i)] = ''
    onChange([...baris, kosong])
  }, [baris, kolom, onChange])
  const hapusBaris = useCallback(
    (barisKe: number) => onChange(baris.filter((_, i) => i !== barisKe)),
    [baris, onChange],
  )

  const isiGroup = (
    <>
      <div className="grid gap-2">
        {baris.length === 0 ? (
          <p className="text-[11px] text-muted">
            Belum ada baris. Tambahkan baris lalu isi kolomnya.
          </p>
        ) : null}
        {baris.map((satu, barisKe) => (
          <div
            key={barisKe}
            className="rounded-lg border border-line-2 bg-surface-2 p-2.5"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <b className="text-[12px] text-ink">Baris {barisKe + 1}</b>
              {readOnly ? null : (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => hapusBaris(barisKe)}
                  aria-label={`Hapus baris ${barisKe + 1}`}
                >
                  Hapus baris
                </Button>
              )}
            </div>
            <div className="grid gap-2.5 max-sm:grid-cols-1 sm:grid-cols-2">
              {Array.from({ length: kolom }, (_, i) => {
                const kunci = kunciKolom(i + 1)
                return (
                  <label
                    key={kunci}
                    className="grid gap-1 text-[11px] font-semibold text-ink-2"
                  >
                    <span>Kolom {i + 1}</span>
                    <Input
                      value={satu[kunci] ?? ''}
                      onChange={(e) =>
                        ubahBaris(barisKe, kunci, e.target.value)
                      }
                      disabled={readOnly}
                    />
                  </label>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      {readOnly ? (
        <p className="mt-2 text-[11px] text-muted">
          Pratinjau: baris group tidak bisa ditambah. Isian group dikirim
          sebagai array baris saat form diisi.
        </p>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            onClick={tambahBaris}
            disabled={baris.length >= MAX_BARIS_GROUP}
          >
            Tambah baris
          </Button>
          <span className="text-[11px] text-muted">
            {baris.length} baris · maksimal {MAX_BARIS_GROUP}
          </span>
        </div>
      )}
    </>
  )

  switch (field.tipe) {
    case 'text': {
      // Field yang menunjuk Data Sasaran: pencarian jalan di browser tiap
      // diketik, jadi state-nya di subkomponen — `DynamicField` sendiri tetap
      // tanpa `useState` supaya `memo`-nya berguna untuk form yang punya ratusan
      // field.
      //
      // `readOnly` (pratinjau Form Builder) sengaja jatuh ke jalur biasa di
      // bawah: pratinjau tidak boleh memanggil server, dan penanda wajibnya
      // sudah dimatikan.
      if (field.cariWarga && !readOnly) {
        return (
          <FieldCariWarga
            kolom={field.cariWarga}
            label={field.label}
            value={value}
            onChange={onChange}
            hint={hint}
            error={error}
            invalid={invalid}
            placeholder={placeholder}
            required={field.wajib}
            onWargaDipilih={onWargaDipilih}
          />
        )
      }

      // Saran hanya untuk field teks: `<datalist>` memang hanya berlaku untuk
      // input teks di browser. Isian tetap bebas — daftar ini suggestion, bukan
      // daftar jawaban wajib (sifat itu datang dari `validasiNilaiOpsiTerpilih`
      // yang hanya berlaku untuk select/radio/checkbox).
      const idDatalist = saranDatalistId(field.id)
      return (
        <FormField
          label={field.label}
          required={field.wajib}
          hint={
            field.saran.length > 0
              ? `${hint ? `${hint} · ` : ''}Ada daftar saran; isi bebas.`
              : hint
          }
          error={error}
          invalid={invalid}
        >
          <Input
            value={teksNilai(value)}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            invalid={invalid}
            disabled={readOnly}
            list={field.saran.length > 0 ? idDatalist : undefined}
          />
          {field.saran.length > 0 ? (
            <datalist id={idDatalist}>
              {field.saran.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          ) : null}
        </FormField>
      )
    }

    case 'textarea':
      return (
        <FormField
          label={field.label}
          required={field.wajib}
          hint={hint}
          error={error}
          invalid={invalid}
        >
          <Textarea
            value={teksNilai(value)}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            invalid={invalid}
            disabled={readOnly}
          />
        </FormField>
      )

    case 'number':
      return (
        <FormField
          label={field.label}
          required={field.wajib}
          hint={hint}
          error={error}
          invalid={invalid}
        >
          <Input
            type="number"
            value={angkaNilai(value)}
            onChange={(e) => onNumber(e.target.value)}
            placeholder={placeholder}
            invalid={invalid}
            disabled={readOnly}
          />
        </FormField>
      )

    case 'date':
    case 'time':
      return (
        <FormField
          label={field.label}
          required={field.wajib}
          hint={hint}
          error={error}
          invalid={invalid}
        >
          <Input
            type={field.tipe}
            value={teksNilai(value)}
            onChange={(e) => onSelect(e.target.value)}
            invalid={invalid}
            disabled={readOnly}
          />
        </FormField>
      )

    case 'select': {
      const opsi = opsiTampil(field)
      return (
        <FormField
          label={field.label}
          required={field.wajib}
          hint={hint}
          error={error}
          invalid={invalid}
        >
          {field.sumberOpsiTidakDikenali ? (
            <PeringatanOpsi pesan={pesanSumberTidakDikenali} />
          ) : null}
          {opsi.length === 0 && !field.sumberOpsiTidakDikenali ? (
            <CatatanOpsiKosong />
          ) : null}
          <Select
            value={teksNilai(value)}
            onChange={(e) => onSelect(e.target.value)}
            invalid={invalid}
            disabled={readOnly || opsi.length === 0}
          >
            <option value="">— Pilih —</option>
            {opsi.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </FormField>
      )
    }

    case 'radio': {
      const opsi = opsiTampil(field)
      return (
        <LabelBlok
          label={field.label}
          required={field.wajib}
          hint={hint}
          error={error}
          invalid={invalid}
        >
          {field.sumberOpsiTidakDikenali ? (
            <PeringatanOpsi pesan={pesanSumberTidakDikenali} />
          ) : null}
          {opsi.length === 0 && !field.sumberOpsiTidakDikenali ? (
            <CatatanOpsiKosong />
          ) : null}
          <div className="grid gap-1.5 max-md:grid-cols-1 sm:grid-cols-2">
            {opsi.map((o) => (
              <RadioCard
                key={o.value}
                title={o.label}
                inputProps={{
                  name: field.id,
                  value: o.value,
                  checked: teksNilai(value) === o.value,
                  onChange: () => onChange(o.value),
                  disabled: readOnly,
                }}
                className={readOnly ? 'cursor-default opacity-70' : undefined}
              />
            ))}
          </div>
        </LabelBlok>
      )
    }

    case 'checkbox': {
      const opsi = opsiTampil(field)
      const terpilih = daftarTeks(value)
      return (
        <LabelBlok
          label={field.label}
          required={field.wajib}
          hint={hint}
          error={error}
          invalid={invalid}
        >
          {field.sumberOpsiTidakDikenali ? (
            <PeringatanOpsi pesan={pesanSumberTidakDikenali} />
          ) : null}
          {opsi.length === 0 && !field.sumberOpsiTidakDikenali ? (
            <CatatanOpsiKosong />
          ) : null}
          <div className="grid gap-1.5">
            {opsi.map((o) => (
              <label
                key={o.value}
                className="flex items-center gap-2 text-[12.5px] text-ink-2"
              >
                <Checkbox
                  size="sm"
                  checked={terpilih.includes(o.value)}
                  onChange={(e) => onCheckbox(o.value, e.currentTarget.checked)}
                  disabled={readOnly}
                />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
        </LabelBlok>
      )
    }

    case 'group':
      return (
        <LabelBlok
          label={field.label}
          required={field.wajib}
          hint={hint}
          error={error}
          invalid={invalid}
        >
          {isiGroup}
        </LabelBlok>
      )

    case 'image':
    case 'file':
      // Tidak ada `onChange` di sini: field ini tidak pernah mengubah state,
      // jadi tidak akan pernah punya nilai yang dikirim ke server.
      return (
        <FormField
          label={field.label}
          required={field.wajib}
          hint={hint}
          error={error}
          invalid={invalid}
        >
          <CatatanLampiran />
        </FormField>
      )
  }
}

/**
 * `memo` itu penting, bukan hiasan: satu form panjang bisa punya ratusan field
 * dalam satu state `answers`, dan tanpa memo setiap ketikan di satu field
 * merender ulang seluruh isian form.
 */
export const DynamicField = memo(DynamicFieldImpl)
