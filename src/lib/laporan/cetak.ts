/**
 * Mencetak hanya satu elemen laporan.
 *
 * Semua saudara elemen di setiap level DOM disembunyikan sementara, lalu
 * dikembalikan setelah dialog print ditutup. Cara ini dipilih karena laporan
 * punya beberapa section yang sama-sama memakai kop; CSS `@media print` tidak
 * bisa tahu section mana yang tombolnya ditekan tanpa menambah atribut ke
 * banyak komponen. Dengan menyembunyikan saudara elemen target, yang tercetak
 * hanya kop, judul, tabel, dan tanda tangan section itu.
 */
export function cetakElemen(target: HTMLElement | null): void {
  if (!target || typeof window === 'undefined') return

  const disembunyikan: Array<{ elemen: HTMLElement; display: string }> = []
  let node: HTMLElement | null = target

  while (node && node !== document.body) {
    const induk: HTMLElement | null = node.parentElement
    if (induk) {
      for (const saudara of Array.from(induk.children)) {
        if (saudara === node) continue

        const elemen = saudara as HTMLElement
        if (elemen.style.display === 'none') continue

        disembunyikan.push({ elemen, display: elemen.style.display })
        elemen.style.display = 'none'
      }
    }
    node = induk
  }

  let sudahDipulihkan = false
  let batasWaktu = 0

  const pulihkan = () => {
    if (sudahDipulihkan) return
    sudahDipulihkan = true

    window.clearTimeout(batasWaktu)
    window.removeEventListener('afterprint', pulihkan)
    window.removeEventListener('focus', pulihkan)

    for (const { elemen, display } of disembunyikan) {
      elemen.style.display = display
    }
  }

  // `afterprint` tidak selalu dikirim (misalnya dialog ditutup lewat Escape di
  // sebagian browser). `focus` menandai user kembali ke halaman setelah dialog
  // tutup, dan batas waktu jadi jaring pengaman terakhir.
  batasWaktu = window.setTimeout(pulihkan, 3000)
  window.addEventListener('afterprint', pulihkan)
  window.addEventListener('focus', pulihkan)
  window.print()
}
