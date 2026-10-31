/**
 * Utilitas untuk mengakses dan mengatur nilai nested path secara immutable.
 * Mendukung path seperti 'info.namaKK', 'info.nik', dll.
 * Tidak menghapus properti tetangga saat mengatur nilai.
 */

function parsePath(path: string): string[] {
  if (!path) return []
  const parts = path.split('.')
  const result: string[] = []
  for (const part of parts) {
    if (part.length > 0) result.push(part)
  }
  return result
}

export function getNestedValue(obj: unknown, path: string): unknown {
  if (obj === null || obj === undefined) return undefined
  if (typeof obj !== 'object') return undefined
  if (Array.isArray(obj)) return undefined
  const parts = parsePath(path)
  let current: unknown = obj
  for (const part of parts) {
    if (current === null || current === undefined) return undefined
    if (typeof current !== 'object') return undefined
    if (Array.isArray(current)) return undefined
    const record = current as Record<string, unknown>
    if (!(part in record)) return undefined
    current = record[part]
  }
  return current
}

export function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> {
  if (!path) return obj
  const parts = parsePath(path)
  if (parts.length === 0) return obj
  if (parts.length === 1) {
    const first = parts[0]!
    const result: Record<string, unknown> = { ...obj }
    result[first] = value
    return result
  }
  const result: Record<string, unknown> = { ...obj }
  let current: Record<string, unknown> = result
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!
    const existing = current[part]
    if (
      existing === null ||
      existing === undefined ||
      typeof existing !== 'object' ||
      Array.isArray(existing)
    ) {
      current[part] = {}
    } else {
      current[part] = { ...(existing as Record<string, unknown>) }
    }
    current = current[part] as Record<string, unknown>
  }
  const lastPart = parts[parts.length - 1]!
  current[lastPart] = value
  return result
}

export function hasNestedPath(obj: unknown, path: string): boolean {
  const value = getNestedValue(obj, path)
  return value !== undefined
}

export function deleteNestedValue(
  obj: Record<string, unknown>,
  path: string,
): Record<string, unknown> {
  if (!path) return obj
  const parts = parsePath(path)
  if (parts.length === 0) return obj
  if (parts.length === 1) {
    const result: Record<string, unknown> = { ...obj }
    const first = parts[0]!
    delete result[first]
    return result
  }
  const result: Record<string, unknown> = { ...obj }
  let current: Record<string, unknown> = result
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!
    const existing = current[part]
    if (
      existing === null ||
      existing === undefined ||
      typeof existing !== 'object' ||
      Array.isArray(existing)
    ) {
      return obj
    }
    current[part] = { ...(existing as Record<string, unknown>) }
    current = current[part] as Record<string, unknown>
  }
  const lastPart = parts[parts.length - 1]!
  delete current[lastPart]
  return result
}
