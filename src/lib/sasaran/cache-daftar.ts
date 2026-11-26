import type { SasaranListResult } from '@/lib/api/server-fns'

const DB_NAME = 'dashboard-pws-cache'
const STORE_NAME = 'sasaran'
const VERSI_CACHE = 1

interface EntriCache {
  hasil: SasaranListResult
  disimpan: number
}

function bukaDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSI_CACHE)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function bacaCacheDaftarSasaran(
  kunci: string,
): Promise<EntriCache | null> {
  if (typeof indexedDB === 'undefined') return null
  try {
    const db = await bukaDatabase()
    return await new Promise((resolve, reject) => {
      const request = db
        .transaction(STORE_NAME)
        .objectStore(STORE_NAME)
        .get(kunci)
      request.onsuccess = () =>
        resolve((request.result as EntriCache | undefined) ?? null)
      request.onerror = () => reject(request.error)
      request.transaction?.addEventListener('complete', () => db.close(), {
        once: true,
      })
    })
  } catch {
    return null
  }
}

export async function simpanCacheDaftarSasaran(
  kunci: string,
  hasil: SasaranListResult,
): Promise<void> {
  if (typeof indexedDB === 'undefined') return
  try {
    const db = await bukaDatabase()
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      transaction
        .objectStore(STORE_NAME)
        .put({ hasil, disimpan: Date.now() } satisfies EntriCache, kunci)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
    db.close()
  } catch {
    // Cache hanya mempercepat tampilan; kegagalannya tidak boleh mengganggu data.
  }
}

/** Hapus cache lama agar daftar berikutnya dibaca ulang dari server. */
export async function hapusCacheDaftarSasaran(): Promise<void> {
  if (typeof indexedDB === 'undefined') return
  try {
    const db = await bukaDatabase()
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite')
        transaction.objectStore(STORE_NAME).clear()
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error)
        transaction.onabort = () => reject(transaction.error)
      })
    } finally {
      db.close()
    }
  } catch {
    // Penyegaran tetap diteruskan meski browser gagal menghapus cache.
  }
}
