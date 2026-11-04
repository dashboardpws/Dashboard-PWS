import type {
  KunjunganRumahDashboardPage,
  KunjunganRumahDashboardPageInput,
} from './dashboard'

const CACHE_TTL_MS = 3600_000
const CACHE_MAX_ENTRIES = 48

interface CacheEntry {
  value: KunjunganRumahDashboardPage
  expiresAt: number
}

const cache = new Map<string, CacheEntry>()
const pending = new Map<
  string,
  { token: object; promise: Promise<KunjunganRumahDashboardPage> }
>()
let cacheVersion = 0

function cacheKey(input: KunjunganRumahDashboardPageInput) {
  return JSON.stringify(input)
}

export function cachedKunjunganRumahDashboardPage(
  input: KunjunganRumahDashboardPageInput,
  load: () => Promise<KunjunganRumahDashboardPage>,
) {
  const key = cacheKey(input)
  const now = Date.now()
  const cached = cache.get(key)
  if (cached && cached.expiresAt > now) {
    cache.delete(key)
    cache.set(key, cached)
    return Promise.resolve(cached.value)
  }
  if (cached) cache.delete(key)

  const existing = pending.get(key)
  if (existing) return existing.promise

  const currentVersion = cacheVersion
  const token = {}
  const request = load()
    .then((value) => {
      if (currentVersion === cacheVersion) {
        cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS })
        if (cache.size > CACHE_MAX_ENTRIES) {
          const oldestKey = cache.keys().next().value
          if (oldestKey) cache.delete(oldestKey)
        }
      }
      return value
    })
    .finally(() => {
      if (pending.get(key)?.token === token) pending.delete(key)
    })
  pending.set(key, { token, promise: request })
  return request
}

/** Hasil drawer harus dibaca ulang setelah ada record yang berubah. */
export function invalidateKunjunganRumahDashboardCache() {
  cacheVersion += 1
  cache.clear()
  pending.clear()
}
