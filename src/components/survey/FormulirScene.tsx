/**
 * Layar isi satu versi form generik.
 *
 * Yang dirender HANYA yang dikirim server: nama form, versi, judul dan deskripsi
 * section, label, placeholder, deskripsi, flag wajib, dan daftar opsi. Tidak ada
 * nama form, `forms.kode`, atau nama field yang ditulis di file ini, jadi form
 * baru yang diterbitkan admin langsung bisa diisi tanpa perubahan kode.
 *
 * Section dirender dalam urutan `urutan` yang sudah diurutkan server.
 *
 * Tiap field dirender oleh `DynamicField` sesuai `tipe`-nya. Scene ini hanya
 * menyediakan tempatnya, penanda wajib, dan jangkar untuk menggulir ke field wajib
 * pertama yang masih kosong.
 *
 * PETUGAS DAN TANGGAL BUKAN BAGIAN DARI FORM
 * -----------------------------------------
 * `surveys.petugasId` dan `surveys.tanggal` NOT NULL, jadi keduanya selalu
 * diisi — tapi keduanya dirender sebagai baris meta di luar daftar section, bukan
 * sebagai section. Alasannya: section di layar ini harus sama persis dengan yang
 * disusun admin di Form Builder, dan admin tidak bisa menyunting section sistem.
 * Petugas tidak bisa diambil dari sesi login karena sesinya satu PIN global
 * (lihat `SESSION_PROFILE` di src/lib/constants.ts).
 */
import { useCallback } from 'react'
import { AppShell } from '@/components/layout'
import { SuccessPanel } from '@/components/shared'
import {
  FillBar,
  FormField,
  PageHeader,
  SaveBar,
  SectionCard,
  Stepper,
  Button,
  ButtonLink,
  Input,
  Select,
} from '@/components/ui'
import type { Step } from '@/components/ui'
import { useToast } from '@/providers/toast'
import { nilaiKosong, useFormRuntime } from '@/hooks/survey/use-form-runtime'
import { DynamicField, fieldAnchorId } from './DynamicField'
import { SaranWargaDropdown } from './SaranWargaDropdown'
import type {
  FieldRuntime,
  DefinisiRuntime,
} from '@/lib/server/survey/form-runtime.server'
import type { SasaranSuggestion } from '@/lib/kunjungan-rumah/sasaran/warga-row'

export interface FormulirSceneProps {
  formVersionId: string
  /** Definisi dari `ambilFormulir`; pemuatan dan kegagalan ditangani halamannya. */
  definisi: DefinisiRuntime
}

/**
 * Satu baris field.
 *
 * Callback `onChange` dibuat di sini, bukan di scene, supaya identitasnya stabil
 * selama `field.id` tidak berubah — itu yang membuat `memo` di `DynamicField`
 * menahan render ulang isian form yang punya ratusan field.
 */
function BarisField({
  field,
  value,
  setAnswer,
  autofillDariField,
  invalid,
}: {
  field: FieldRuntime
  value: unknown
  setAnswer: (fieldId: string, value: unknown) => void
  autofillDariField: (triggerFieldId: string, row: SasaranSuggestion) => void
  invalid: boolean
}) {
  const onChange = useCallback(
    (baru: unknown) => setAnswer(field.id, baru),
    [setAnswer, field.id],
  )
  return (
    <div id={fieldAnchorId(field.id)}>
      <DynamicField
        field={field}
        value={value}
        onChange={onChange}
        onWargaDipilih={(row) => autofillDariField(field.id, row)}
        invalid={invalid}
      />
    </div>
  )
}

export function FormulirScene({ formVersionId, definisi }: FormulirSceneProps) {
  const toast = useToast()
  const {
    form,
    version,
    answers,
    setAnswer,
    autofillDariField,
    firstMissingRequiredId,
    kosongWajib,
    fillPercent,
    fieldsWajib,
    percobaanKirim,
    petugasId,
    setPetugasId,
    petugasOpsi,
    petugasLoading,
    petugasError,
    subjekWargaWajib,
    wargaNik,
    ketikWargaNik,
    warga,
    pilihWarga,
    cariWarga,
    setCariWarga,
    saranWarga,
    mencariWarga,
    saranError,
    tanggal,
    setTanggal,
    visibleSections,
    submit,
    saving,
    error,
    saved,
    reset,
  } = useFormRuntime({ formVersionId, definisi })

  /** Penanda wajib hanya menyala setelah petugas pernah menekan Simpan. */
  const kosongkan = (field: FieldRuntime) =>
    percobaanKirim && field.wajib && nilaiKosong(answers[field.id])
  const petugasKurang = percobaanKirim && petugasId.trim() === ''
  const wargaKurang =
    percobaanKirim && subjekWargaWajib && wargaNik.trim() === ''

  const onSimpan = () => {
    void submit().then((hasil) => {
      if (hasil) {
        toast('Isian form tersimpan di database.')
        return
      }
      // Gagal kirim karena ada yang belum terisi: perlihat petugas mana duluan.
      // Ini hanya penandaan wajib di scene, BUKAN satu-satunya pemeriksaan —
      // penolakan tetap datang dari server.
      if (firstMissingRequiredId !== null && typeof document !== 'undefined') {
        document
          .getElementById(fieldAnchorId(firstMissingRequiredId))
          ?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          })
      }
    })
  }

  const jumlahField = visibleSections.reduce((n, s) => n + s.fields.length, 0)

  /** Satu section dianggap selesai kalau setiap field wajibnya sudah terisi. */
  const sectionLengkap = (section: (typeof visibleSections)[number]): boolean =>
    section.fields.every((f) => !f.wajib || !nilaiKosong(answers[f.id]))

  /**
   * Angka langkah untuk `Stepper`: semua yang selesai sebelum bagian pertama
   * yang belum lengkap berstatus "done", yang pertama itu "now", sisanya "todo".
   */
  const langkahSekarang = visibleSections.findIndex((s) => !sectionLengkap(s))
  const metaLengkap = petugasId.trim() !== '' && !nilaiKosong(tanggal)
  /**
   * Langkah "Simpan" baru hijau kalau tidak ada satu pun yang tertinggal —
   * petugas, tanggal, dan seluruh pertanyaan wajib.
   */
  const belumAdaSisa =
    metaLengkap && langkahSekarang === -1 && kosongWajib === 0

  const steps: Step[] = [
    ...visibleSections.map((section, i): Step => ({
      label: section.nama,
      state:
        langkahSekarang === -1 || i < langkahSekarang
          ? 'done'
          : i === langkahSekarang
            ? 'now'
            : 'todo',
    })),
    { label: 'Simpan', state: belumAdaSisa ? 'done' : 'todo' },
  ]

  return (
    <AppShell>
      <PageHeader
        title={form.nama}
        description={`Versi ${version.version} · ${visibleSections.length} bagian · ${jumlahField} pertanyaan. ${
          form.deskripsi ||
          'Daftar pertanyaan, opsi jawaban, dan bagiannya ditentukan Admin di Kelola, lalu diisi di sini.'
        }`}
      />

      <Stepper steps={steps} />
      <FillBar
        label={`${fieldsWajib.length - kosongWajib} dari ${fieldsWajib.length} pertanyaan wajib terisi`}
        pct={fillPercent}
      />

      {/*
        Data pencatatan BUKAN section form. Section di bawahnya persis dengan yang
        disusun admin di Form Builder, jadi blok ini sengaja tidak memakai
        `SectionCard` dan tidak diberi nomor: kalau ikut menjadi "1. Data
        pencatatan", petugas mengira itu bagian dari form padahal tidak bisa
        disunting di editor.

        Petugas tetap wajib diisi: `surveys.petugasId` NOT NULL dan sesinya cuma
        satu PIN global, jadi petugas tidak bisa diambil dari user yang sedang
        mengisi. Tanggal sudah terisi hari ini secara bawaan.
      */}
      <div className="mt-3 flex flex-wrap items-end gap-3 rounded-[10px] border border-line bg-surface px-3.5 py-3">
        <FormField
          label="Petugas pencatat"
          required
          className="min-w-56"
          hint="Disimpan bersama isian dan ikut ke rekap per petugas."
          invalid={petugasKurang}
          error="Pilih petugas pencatat."
        >
          <Select
            value={petugasId}
            onChange={(e) => setPetugasId(e.target.value)}
            disabled={petugasLoading}
            invalid={petugasKurang}
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

        <FormField
          label="Tanggal isian"
          required
          className="min-w-44"
          hint="Dipakai rekap harian dan bulanan."
        >
          <Input
            type="date"
            value={tanggal}
            onChange={(e) => setTanggal(e.target.value)}
          />
        </FormField>

        <p className="max-w-64 text-[11px] font-normal text-muted">
          Petugas dan tanggal diisi di luar form. Kalau form ini butuh data
          petugas atau warga sebagai pertanyaan, tambahkan sendiri sebagai field
          di Form Builder.
        </p>
        {petugasError ? (
          <p className="text-[11px] font-semibold text-danger">
            {petugasError}
          </p>
        ) : null}
      </div>

      {/*
        Pemilih warga hanya untuk form dengan `subjekWargaWajib` true, yaitu Form
        Kunjungan Rumah. Form dari Form Builder tidak pernah menunjuk warga per
        submission, jadi tidak ada apa pun soal warga di sana.
      */}
      {subjekWargaWajib ? (
        <div className="mt-3 rounded-[10px] border border-line bg-surface px-3.5 py-3">
          <FormField
            label="Warga sasaran"
            required
            hint="Ketik nama, KK, atau NIK (minimal 3 huruf) lalu pilih dari Data Sasaran. NIK juga bisa diketik langsung kalau sudah diketahui; NIK yang tidak ada di Data Sasaran ditolak saat menyimpan."
            invalid={wargaKurang}
            error="Pilih warga dari Data Sasaran."
          >
            <div className="relative">
              <Input
                value={cariWarga}
                onChange={(e) => setCariWarga(e.target.value)}
                placeholder="cari nama, KK, atau NIK…"
                autoComplete="off"
                invalid={wargaKurang}
              />
              <SaranWargaDropdown
                rows={saranWarga}
                busy={mencariWarga}
                onPilih={pilihWarga}
                tampilkanKelurahan
              />
            </div>
            <Input
              value={wargaNik}
              onChange={(e) => ketikWargaNik(e.target.value)}
              placeholder="NIK warga (16 digit)"
              inputMode="numeric"
              maxLength={16}
              invalid={wargaKurang}
              aria-label="NIK warga"
            />
            <span className="text-[11px] font-normal text-muted">
              {warga
                ? `${warga.namaArt || warga.namaKk || 'Warga'} · NIK ${warga.nik} · ${warga.kelurahan ?? 'kelurahan belum ada'}`
                : 'Belum ada warga yang dipilih.'}
            </span>
          </FormField>
          {saranError ? (
            <p className="mt-2 text-[11px] font-semibold text-danger">
              {saranError}
            </p>
          ) : null}
        </div>
      ) : null}

      {visibleSections.map((section, index) => (
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
          {section.fields.map((field) => (
            <BarisField
              key={field.id}
              field={field}
              value={answers[field.id]}
              setAnswer={setAnswer}
              autofillDariField={autofillDariField}
              invalid={kosongkan(field)}
            />
          ))}
        </SectionCard>
      ))}

      {visibleSections.length === 0 ? (
        <SectionCard title="Belum ada pertanyaan">
          <p className="text-[12.5px] text-muted">
            Form ini belum punya pertanyaan aktif. Admin belum menyusunnya di
            Kelola.
          </p>
        </SectionCard>
      ) : null}

      <SectionCard
        title={`${visibleSections.length + 1}. Simpan`}
        actions={
          <SaveBar
            onReset={reset}
            onSubmit={onSimpan}
            disabled={saving}
            submitLabel={saving ? 'Menyimpan…' : 'Simpan isian'}
          />
        }
      >
        <div className="grid gap-1.5">
          <span className="text-xs text-muted">
            Tanda bintang menandai pertanyaan wajib. Pemeriksaan terakhir tetap
            dilakukan server saat menyimpan, dan pesan yang muncul berasal dari
            sana.
          </span>
          {error ? (
            <span className="text-xs font-semibold text-danger">{error}</span>
          ) : null}
        </div>
      </SectionCard>

      {saved ? (
        <SuccessPanel
          title="Isian form tersimpan."
          message={`${saved.jumlahJawaban} jawaban tercatat di database bersama petugas pencatat dan tanggal isian. Form dengan struktur sama bisa diisi lagi kapan saja.`}
        >
          <Button
            variant="primary"
            onClick={() => {
              reset()
              if (typeof window !== 'undefined')
                window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
          >
            Isi formulir ini lagi
          </Button>
          <ButtonLink to="/form" search={{ jenis: '' }} variant="primary">
            Isi formulir lain
          </ButtonLink>
        </SuccessPanel>
      ) : null}
    </AppShell>
  )
}
