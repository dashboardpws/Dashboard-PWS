/**
 * Dialog hapus satu versi draft atau arsip dari Form Builder.
 *
 * Versi yang memiliki isian tidak boleh dihapus agar histori data lapangan
 * tetap terikat ke struktur form asalnya. Yang boleh dihapus hanya struktur
 * versi tanpa isian.
 *
 * Karena itu dialog ini tidak mewajibkan mengetik nama. Yang ditampilkan tetap
 * jumlah section dan field supaya admin tahu sedang membuang berapa banyak
 * pekerjaan, dan supaya "Hapus" yang diklik terasa disengaja.
 *
 * Angka dikirim server lewat `ringkasanHapusDraftBuilder`, dan kelayakan hapus
 * ditegakkan ulang di `validasiHapusDraftVersi` saat penghapusan benar-benar
 * dijalankan. Dialog tidak menentukan sendiri apa yang boleh dihapus.
 */
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Angka, ModalOverlay } from '@/components/ui/ModalOverlay'
import { PeringatanBox } from '@/components/shared'
import type { RingkasanHapusDraft } from '@/lib/service/form-builder/validasi'

interface Props {
  /** Nomor versi yang akan dihapus, untuk menyebut di teks dialog. */
  version: number
  status: 'draft' | 'archived'
  ringkasan: RingkasanHapusDraft | null
  busy?: boolean
  onClose: () => void
  onConfirm: () => void
}

export function HapusDraftDialog({
  version,
  status,
  ringkasan,
  busy = false,
  onClose,
  onConfirm,
}: Props) {
  if (!ringkasan) return null
  const namaVersi = status === 'draft' ? 'draft' : 'arsip'

  return (
    <ModalOverlay
      title={`Hapus ${namaVersi} v${version}`}
      ariaLabel="Hapus versi form"
      onClose={onClose}
      width="max-w-[480px]"
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button
            variant="danger"
            onClick={onConfirm}
            disabled={busy || ringkasan.jumlahSubmit > 0}
          >
            <Trash2 className="w-4 h-4" /> Hapus{' '}
            {status === 'draft' ? 'Draft' : 'Arsip'}
          </Button>
        </>
      }
    >
      <div className="mt-3.5 grid grid-cols-2 gap-2">
        <Angka label="Section" value={ringkasan.jumlahSection} />
        <Angka label="Pertanyaan" value={ringkasan.jumlahField} />
      </div>

      {ringkasan.jumlahSubmit > 0 ? (
        <PeringatanBox className="mt-3">
          Versi ini memiliki {ringkasan.jumlahSubmit} isian, jadi tidak bisa
          dihapus. Isian form harus tetap tersimpan bersama versi asalnya.
        </PeringatanBox>
      ) : (
        <p className="mt-3 text-[12.5px] text-muted">
          Versi ini tidak memiliki isian. Yang dihapus adalah section,
          pertanyaan, dan opsinya; struktur yang dihapus tidak bisa dipulihkan.
        </p>
      )}
    </ModalOverlay>
  )
}
