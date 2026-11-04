import { useState, useEffect } from 'react'
import { AdminModal } from './AdminModal'
import { HapusFormDialog } from './HapusFormDialog'
import { HapusDraftDialog } from './HapusDraftDialog'
import { FormBuilderWorkspace } from '@/components/kelola/builder/FormBuilderWorkspace'
import {
  Button,
  EmptyState,
  Input,
  StatusBadge,
  Textarea,
  Card,
  CardHeader,
} from '@/components/ui'
import { useToast } from '@/providers/toast'
import { useFormBuilder } from '@/hooks/kelola/use-form-builder'
import { useFormBuilderDraft } from '@/hooks/kelola/use-form-builder-draft'
import { Loader } from '@mantine/core'
import { useNavigate } from '@tanstack/react-router'

export interface FormBuilderSectionProps {
  mode?: 'list' | 'editor'
  selectedFormId?: number
}

const LABEL_STATUS: Record<string, string> = {
  draft: 'Draft',
  published: 'Tayang',
  archived: 'Diarsipkan',
}

export function FormBuilderSection({
  mode = 'list',
  selectedFormId,
}: FormBuilderSectionProps) {
  const {
    forms,
    formId,
    versi,
    versiTerpilih,
    formVersionId,
    definisi,
    loading,
    loadingDefinisi,
    definisiError,
    saving,
    error,
    bisaUbah,
    bawaan,
    pilihForm,
    pilihVersi,
    buatForm,
    hapusForm,
    ringkasanHapus,
    bukaDialogHapus,
    tutupDialogHapus,
    terbitkan,
    buatDraft,
    bukaDialogHapusDraft,
    tutupDialogHapusDraft,
    ringkasanHapusDraft,
    hapusDraft,
  } = useFormBuilder()

  const toast = useToast()
  const navigate = useNavigate()
  const draft = useFormBuilderDraft()
  const { loadDocument, clearDocument, document, ...draftRest } = draft

  const [modalForm, setModalForm] = useState(false)
  const [nama, setNama] = useState('')
  const [deskripsi, setDeskripsi] = useState('')
  const [targetHapus, setTargetHapus] = useState<{
    formId: number
    nama: string
  } | null>(null)

  const formTerpilih = forms.find((f) => f.id === formId) ?? null

  useEffect(() => {
    if (
      mode === 'editor' &&
      !loading &&
      selectedFormId &&
      formId !== selectedFormId
    ) {
      if (forms.some((form) => form.id === selectedFormId)) {
        void pilihForm(selectedFormId)
      }
    }
  }, [mode, loading, selectedFormId, formId, forms, pilihForm])

  const tambahForm = async () => {
    if (!nama.trim()) return
    await buatForm(nama.trim(), deskripsi.trim())
    setModalForm(false)
    setNama('')
    setDeskripsi('')
  }

  /**
   * Hapus form lalu sebut angka yang benar-benar hilang, supaya admin tidak
   * hanya melihat toast "berhasil" tanpa tahu combien data yang ikut hilang.
   */
  const konfirmasiHapus = async (konfirmasiNama: string | null) => {
    if (!targetHapus) return
    const hasil = await hapusForm(
      targetHapus.formId,
      konfirmasiNama ?? undefined,
    )
    if (!hasil) return
    setTargetHapus(null)
    toast(
      hasil.jumlahSubmit > 0
        ? `Form dihapus permanen: ${hasil.jumlahVersi} versi, ${hasil.jumlahSubmit} isian, ${hasil.jumlahJawaban} jawaban.`
        : `Form dihapus: ${hasil.jumlahVersi} versi, ${hasil.jumlahJawaban} jawaban.`,
    )
  }

  useEffect(() => {
    if (definisi) {
      loadDocument(definisi)
    } else {
      clearDocument()
    }
  }, [definisi, loadDocument, clearDocument])

  /**
   * Hapus draft, lalu sebut angka yang hilang supaya admin tahu berapa banyak
   * pertanyaan yang dibuang — "berhasil" tanpa angka tidak dipercaya untuk
   * pekerjaan yang tidak bisa dipulihkan.
   */
  const konfirmasiHapusDraft = async () => {
    const berhasil = await hapusDraft()
    if (!berhasil) return
    const r = ringkasanHapusDraft
    toast(
      r
        ? `Draft dihapus: ${r.jumlahSection} section, ${r.jumlahField} pertanyaan.`
        : 'Draft dihapus.',
    )
  }

  const handleBack = () => navigate({ to: '/kelola' })

  return (
    <div className="mt-4">
      {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}

      {mode === 'editor' &&
      !loading &&
      selectedFormId &&
      !forms.some((form) => form.id === selectedFormId) ? (
        <EmptyState title="Form tidak ditemukan." className="mt-3">
          <p>Kembali ke Kelola untuk memilih form yang tersedia.</p>
        </EmptyState>
      ) : null}

      {mode === 'list' ? (
        <Card>
          <CardHeader
            title="Form"
            sub="Form bawaan sistem ikut tampil dan bisa disunting di sini lewat draft baru. Strukturnya sebagian terkunci karena form kader membacanya lewat nama section dan kode field."
            actions={
              <Button
                variant="export"
                size="sm"
                onClick={() => setModalForm(true)}
              >
                Form Baru
              </Button>
            }
          />

          {loading ? (
            <div className="flex gap-3 items-center p-2">
              <Loader size="xs" color="gray" />
              <p className=" mt-1 text-sm text-muted">Memuat daftar form…</p>
            </div>
          ) : null}

          {!loading && forms.length === 0 ? (
            <EmptyState title="Belum ada form." className="mt-3">
              <p>Buat form dulu, lalu susun pertanyaannya per section.</p>
            </EmptyState>
          ) : null}

          {forms.length > 0 ? (
            <ul className="mt-3 grid gap-1.5">
              {forms.map((form) => (
                <li key={form.id}>
                  <div
                    className={`flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 ${
                      form.id === formId
                        ? 'border-accent-border bg-accent-light'
                        : 'border-line'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (mode === 'list') {
                          void navigate({
                            to: '/kelola/form-builder/$formId',
                            params: { formId: String(form.id) },
                          })
                        } else {
                          void pilihForm(form.id)
                        }
                      }}
                      className="flex-1 text-left text-sm! font-semibold text-ink"
                    >
                      {form.nama}
                    </button>
                    <div className="flex items-center gap-2">
                      {form.kode ? (
                        <StatusBadge variant="process">Bawaan</StatusBadge>
                      ) : null}
                      <StatusBadge variant={form.aktif ? 'done' : 'off'}>
                        {form.aktif ? 'Aktif' : 'Nonaktif'}
                      </StatusBadge>
                      {/* Form bawaan tidak bisa dihapus — server juga menolaknya.
                        Tombolnya disembunyikan supaya tidak menawarkan aksi yang
                        pasti gagal. */}
                      {form.kode ? null : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            setTargetHapus({ formId: form.id, nama: form.nama })
                            void bukaDialogHapus(form.id)
                          }}
                          disabled={saving}
                        >
                          Hapus
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      ) : null}

      {mode === 'editor' && formTerpilih ? (
        <>
          <Card className="my-3">
            <CardHeader
              title={`Versi — ${formTerpilih.nama}`}
              sub="Satu form hanya boleh punya satu versi yang tayang. Versi yang tayang dibekukan, perubahan harus lewat draft baru."
              actions={
                <>
                  <Button
                    size="sm"
                    disabled={!bisaUbah || saving}
                    variant="export"
                    onClick={() => void terbitkan()}
                  >
                    Terbitkan
                  </Button>
                  <Button
                    size="sm"
                    disabled={saving}
                    onClick={() => void buatDraft()}
                  >
                    Draft Berikutnya
                  </Button>
                  {/* Tombol hapus draft hanya ditawarkan kalau versinya
                      boleh dihapus: harus draft, form bukan bawaan, dan bukan
                      satu-satunya versi. Tiga syarat yang sama dicek
                      ulang oleh `validasiHapusDraftVersi` di server. */}
                  {bisaUbah && !bawaan && versi.length > 1 ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:bg-destructive/10"
                      disabled={saving}
                      onClick={() =>
                        formVersionId
                          ? void bukaDialogHapusDraft(formVersionId)
                          : null
                      }
                      title="Buang draft ini beserta section dan pertanyaannya"
                    >
                      Hapus Draft
                    </Button>
                  ) : null}
                </>
              }
            />

            <div className="mt-3 flex flex-wrap items-end gap-2">
              {versi.map((v) => (
                <Button
                  key={v.id}
                  size="sm"
                  variant={v.id === formVersionId ? 'export' : 'default'}
                  onClick={() => void pilihVersi(v.id)}
                >
                  v{v.version} · {LABEL_STATUS[v.status] ?? v.status}
                </Button>
              ))}
            </div>

            {versiTerpilih && !bisaUbah ? (
              <p className="mt-3 text-[13px] text-muted">
                Versi ini{' '}
                {LABEL_STATUS[versiTerpilih.status]?.toLowerCase() ??
                  versiTerpilih.status}{' '}
                dan tidak bisa diubah. Buat draft berikutnya untuk
                menyuntingnya.
              </p>
            ) : null}
          </Card>

          {loadingDefinisi || !definisi ? (
            definisiError ? (
              <p className="mt-3 text-[13px] text-destructive">
                Gagal memuat definisi: {definisiError}
              </p>
            ) : (
              <p className="mt-3 text-[13px] text-muted">Memuat isi form…</p>
            )
          ) : (
            <FormBuilderWorkspace
              formVersionId={formVersionId!}
              bisaUbah={bisaUbah}
              kodeForm={formTerpilih.kode ?? null}
              onBack={handleBack}
              document={document}
              draft={draftRest}
              loadDocument={loadDocument}
            />
          )}
        </>
      ) : null}

      {modalForm ? (
        <AdminModal
          title="Form Baru"
          onClose={() => setModalForm(false)}
          onSave={() => void tambahForm()}
        >
          <label className="grid gap-1">
            <span className="text-xs font-bold text-ink-2">Nama form</span>
            <Input
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="Contoh: Monitoring Ibu Hamil"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-bold text-ink-2">
              Deskripsi (opsional)
            </span>
            <Textarea
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value)}
            />
          </label>
        </AdminModal>
      ) : null}

      {targetHapus ? (
        <HapusFormDialog
          nama={targetHapus.nama}
          ringkasan={ringkasanHapus}
          busy={saving}
          onClose={() => {
            setTargetHapus(null)
            tutupDialogHapus()
          }}
          onConfirm={(konfirmasiNama) => void konfirmasiHapus(konfirmasiNama)}
        />
      ) : null}

      {ringkasanHapusDraft ? (
        <HapusDraftDialog
          version={versiTerpilih?.version ?? 0}
          ringkasan={ringkasanHapusDraft}
          busy={saving}
          onClose={tutupDialogHapusDraft}
          onConfirm={() => void konfirmasiHapusDraft()}
        />
      ) : null}
    </div>
  )
}
