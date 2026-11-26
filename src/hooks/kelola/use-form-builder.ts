import { useCallback, useEffect, useState } from 'react'
import {
  ambilEditorForm,
  daftarJenisField,
  buatDraftBuilder,
  buatFormBuilder,
  daftarVersiBuilder,
  hapusDraftBuilder,
  hapusFormBuilder,
  listFormBuilder,
  ringkasanHapusDraftBuilder,
  terbitkanVersiBuilder,
  ringkasanHapusFormBuilder,
} from '@/lib/api/server-fns'
import { invalidateNavForms } from '@/lib/nav/nav-forms-cache'
import type { ambilDefinisiVersi } from '@/lib/server/form-builder/section.server'
import type {
  daftarVersiForm,
  HasilHapusForm,
  listFormBaru,
} from '@/lib/server/form-builder/form.server'
import type {
  RingkasanHapusDraft,
  RingkasanHapusForm,
} from '@/lib/service/form-builder/validasi'

export type DefinisiVersi = Awaited<ReturnType<typeof ambilDefinisiVersi>>
export type BarisVersi = Awaited<ReturnType<typeof daftarVersiForm>>[number]
export type BarisFormBaru = Awaited<ReturnType<typeof listFormBaru>>[number]

function pesanError(
  err: unknown,
  cadangan = 'Gagal menyimpan perubahan form.',
): string {
  if (err instanceof Error && err.message) return err.message
  return cadangan
}

/**
 * State tab Form Builder di /kelola.
 *
 * Alurnya mengikuti siklus versi form: pilih form, pilih versi, baru editor
 * dibuka. Versi `published` bisa dibaca tapi tidak bisa diubah, jadi `bisaUbah`
 * dihitung dari status versi dan dipakai komponen editor untuk mengunci tombol.
 *
 * Versi yang tayang otomatis dibuka kalau form belum pernah dibuka, supaya admin
 * tidak mendarat di layar kosong.
 */
export function useFormBuilder() {
  const [forms, setForms] = useState<BarisFormBaru[]>([])
  const [formId, setFormId] = useState<number | null>(null)
  const [versi, setVersi] = useState<BarisVersi[]>([])
  const [formVersionId, setFormVersionId] = useState<string | null>(null)
  const [definisi, setDefinisi] = useState<DefinisiVersi | null>(null)
  const [loadingForms, setLoadingForms] = useState(true)
  const [loadingDefinisi, setLoadingDefinisi] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [definisiError, setDefinisiError] = useState<string | null>(null)
  const [ringkasanHapus, setRingkasanHapus] =
    useState<RingkasanHapusForm | null>(null)
  const [ringkasanHapusDraft, setRingkasanHapusDraft] =
    useState<RingkasanHapusDraft | null>(null)
  const [semuaTipe, setSemuaTipe] = useState<readonly string[]>([])
  const [butuhOpsi, setButuhOpsi] = useState<readonly string[]>([])

  const versiTerpilih = versi.find((v) => v.id === formVersionId) ?? null
  const bisaUbah = versiTerpilih?.status === 'draft'
  /**
   * Form bawaan sistem (`forms.kode` ada) ditampilkan juga di editor, tapi
   * strukturnya terkunci dan tidak bisa dihapus. Penegakannya ada di server
   * (`buildFormVersion` dan `ringkasanHapusForm`); nilai ini hanya supaya
   * kontrol yang sudah pasti ditolak tidak ditawarkan sebagai pilihan.
   */
  const bawaan = (forms.find((f) => f.id === formId)?.kode ?? null) !== null

  // Daftar tipe dibaca dari server, bukan ditulis ulang di editor: backend yang
  // menolak field tanpa opsi, jadi dua daftar di tempat berbeda cepat tidak sinkron.
  useEffect(() => {
    void (async () => {
      try {
        const daftar = await daftarJenisField()
        setSemuaTipe(daftar.semua)
        setButuhOpsi(daftar.butuhOpsi)
      } catch {
        setError('Gagal memuat daftar tipe field.')
      }
    })()
  }, [])

  const muatForms = useCallback(async () => {
    setLoadingForms(true)
    setError(null)
    try {
      const daftar = await listFormBuilder()
      setForms(daftar)
    } catch (err) {
      setError(pesanError(err))
    } finally {
      setLoadingForms(false)
    }
  }, [])

  useEffect(() => {
    void muatForms()
  }, [muatForms])

  const muatDefinisi = useCallback(async (versionId: string) => {
    setLoadingDefinisi(true)
    setDefinisiError(null)
    try {
      setDefinisi(await ambilEditorForm({ data: { formVersionId: versionId } }))
    } catch (err) {
      setDefinisiError(pesanError(err))
      setDefinisi(null)
    } finally {
      setLoadingDefinisi(false)
    }
  }, [])

  const pilihForm = useCallback(async (id: number) => {
    setFormId(id)
    setFormVersionId(null)
    setDefinisi(null)
    setVersi([])
    setError(null)
    setDefinisiError(null)
    setLoadingDefinisi(true)
    try {
      const daftar = await daftarVersiBuilder({ data: { formId: id } })
      setVersi(daftar)
      // Buka versi yang bisa diedit kalau ada; kalau tidak, versi terbaru saja
      // supaya form published yang belum pernah diutak-atik tetap terlihat.
      const draft = daftar.find((v) => v.status === 'draft') ?? daftar[0]
      if (draft) {
        setFormVersionId(draft.id)
        setDefinisi(
          await ambilEditorForm({ data: { formVersionId: draft.id } }),
        )
      } else {
        setDefinisi(null)
      }
    } catch (err) {
      setDefinisiError(pesanError(err))
      setDefinisi(null)
    } finally {
      setLoadingDefinisi(false)
    }
  }, [])

  const pilihVersi = useCallback(
    async (versionId: string) => {
      setFormVersionId(versionId)
      await muatDefinisi(versionId)
    },
    [muatDefinisi],
  )

  const buatForm = useCallback(
    async (nama: string, deskripsi: string) => {
      setSaving(true)
      setError(null)
      try {
        const hasil = await buatFormBuilder({ data: { nama, deskripsi } })
        await muatForms()
        await pilihForm(hasil.formId)
        invalidateNavForms()
      } catch (err) {
        setError(pesanError(err))
      } finally {
        setSaving(false)
      }
    },
    [muatForms, pilihForm],
  )

  /** Jalankan satu tulis, lalu muat ulang definisi versi supaya layar ikut berubah. */
  const jalankan = useCallback(
    async (aksi: () => Promise<unknown>) => {
      setSaving(true)
      setError(null)
      try {
        await aksi()
        if (formVersionId) await muatDefinisi(formVersionId)
        if (formId) setVersi(await daftarVersiBuilder({ data: { formId } }))
      } catch (err) {
        setError(pesanError(err))
      } finally {
        setSaving(false)
      }
    },
    [formVersionId, formId, muatDefinisi],
  )

  /**
   * Buka dialog hapus: ambil ringkasan isi form dari server lebih dulu, supaya
   * admin melihat jumlah versi, isian, dan jawaban yang akan hilang.
   */
  const bukaDialogHapus = useCallback(async (id: number) => {
    setSaving(true)
    setError(null)
    try {
      setRingkasanHapus(
        await ringkasanHapusFormBuilder({ data: { formId: id } }),
      )
    } catch (err) {
      setError(pesanError(err, 'Ringkasan form tidak bisa dimuat. Coba lagi.'))
      setRingkasanHapus(null)
    } finally {
      setSaving(false)
    }
  }, [])

  const tutupDialogHapus = useCallback(() => setRingkasanHapus(null), [])

  /**
   * Hapus form. `konfirmasiNama` hanya relevan kalau form sudah punya isian;
   * server menolak tanpa `hapusPermanent` supaya tidak ada data petugas yang
   * hilang karena satu klik.
   */
  const hapusForm = useCallback(
    async (
      id: number,
      konfirmasiNama?: string,
    ): Promise<HasilHapusForm | null> => {
      setSaving(true)
      setError(null)
      try {
        const hasil = await hapusFormBuilder({
          data: {
            formId: id,
            hapusPermanent: true,
            konfirmasiNama: konfirmasiNama ?? null,
          },
        })
        setForms((sebelum) => sebelum.filter((f) => f.id !== id))
        setRingkasanHapus(null)
        if (id === formId) {
          setFormId(null)
          setFormVersionId(null)
          setDefinisi(null)
          setVersi([])
        }
        return hasil
      } catch (err) {
        setError(pesanError(err, 'Form tidak bisa dihapus. Coba lagi.'))
        return null
      } finally {
        setSaving(false)
      }
    },
    [formId],
  )

  const terbitkan = useCallback(() => {
    if (!formVersionId) return Promise.resolve()
    return jalankan(async () => {
      await terbitkanVersiBuilder({ data: { formVersionId } })
      invalidateNavForms()
    })
  }, [jalankan, formVersionId])

  /**
   * Draft baru dibuat dari versi yang sedang dibuka. Versi published lama dibekukan,
   * jadi admin yang mau mengubah form tayang harus lewat sini.
   */
  const buatDraft = useCallback(async () => {
    if (!formId) return
    setSaving(true)
    setError(null)
    setDefinisiError(null)
    setLoadingDefinisi(true)
    try {
      const baru = await buatDraftBuilder({
        data: { formId, dariVersiId: formVersionId ?? undefined },
      })
      const [daftar, definisiBaru] = await Promise.all([
        daftarVersiBuilder({ data: { formId } }),
        ambilEditorForm({ data: { formVersionId: baru } }),
      ])
      setVersi(daftar)
      setFormVersionId(baru)
      setDefinisi(definisiBaru)
    } catch (err) {
      setError(pesanError(err, 'Draft baru tidak bisa dibuat.'))
    } finally {
      setSaving(false)
      setLoadingDefinisi(false)
    }
  }, [formId, formVersionId])

  /**
   * Buka dialog hapus versi: ambil isi draft atau arsip dari server lebih dulu,
   * supaya admin melihat jumlah section dan field yang akan hilang.
   *
   * Dialog tetap dibuka walau server menolak (mis. draft sudah berisian), karena
   * pesannya justru yang perlu dibaca admin. Menutup dialog otomatis di sini
   * membuat penolakan tidak terlihat sama sekali.
   */
  const bukaDialogHapusDraft = useCallback(async (versionId: string) => {
    setSaving(true)
    setError(null)
    try {
      setRingkasanHapusDraft(
        await ringkasanHapusDraftBuilder({
          data: { formVersionId: versionId },
        }),
      )
    } catch (err) {
      setError(pesanError(err, 'Isi versi tidak bisa dimuat. Coba lagi.'))
      setRingkasanHapusDraft(null)
    } finally {
      setSaving(false)
    }
  }, [])

  const tutupDialogHapusDraft = useCallback(
    () => setRingkasanHapusDraft(null),
    [],
  )

  /**
   * Hapus versi draft atau arsip yang sedang dibuka.
   *
   * Setelah draft hilang, editor harus tetap punya sesuatu untuk ditampilkan:
   * pindah ke draft lain kalau masih ada, kalau tidak ke versi terbaru. Kalau
   * form kehilangan seluruh versinya, kembalikan ke layar daftar form — tidak
   * ada editor untuk form tanpa versi.
   *
   * Server menolak published, versi berisian, atau versi terakhir; pesan
   * penolakannya disimpan di `error`.
   */
  const hapusDraft = useCallback(async (): Promise<boolean> => {
    if (!formVersionId || !formId) return false
    setSaving(true)
    setError(null)
    try {
      await hapusDraftBuilder({ data: { formVersionId } })
      setRingkasanHapusDraft(null)

      const daftar = await daftarVersiBuilder({ data: { formId } })
      setVersi(daftar)

      // Versi terhapus tidak mungkin ada di daftar baru: server sudah menolak
      // menghapus versi terakhir, jadi daftar kosong berarti ada kondisi lain
      // (mis. form dihapus dari tab lain) dan yang aman adalah keluar dari editor.
      const berikut = daftar.find((v) => v.status === 'draft') ?? daftar[0]
      if (berikut) {
        setFormVersionId(berikut.id)
        setDefinisi(
          await ambilEditorForm({ data: { formVersionId: berikut.id } }),
        )
      } else {
        setFormVersionId(null)
        setDefinisi(null)
      }
      return true
    } catch (err) {
      setError(pesanError(err, 'Versi tidak bisa dihapus. Coba lagi.'))
      setRingkasanHapusDraft(null)
      return false
    } finally {
      setSaving(false)
    }
  }, [formVersionId, formId])

  return {
    forms,
    formId,
    versi,
    versiTerpilih,
    bawaan,
    formVersionId,
    definisi,
    semuaTipe,
    butuhOpsi,
    loading: loadingForms,
    loadingDefinisi,
    definisiError,
    saving,
    error,
    bisaUbah,
    muatForms,
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
  }
}
