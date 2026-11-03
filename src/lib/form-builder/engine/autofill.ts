/**
 * Pure engine untuk menerapkan autofill.
 * Mendukung penanganan path bersarang (nested key/object) tanpa merusak properti tetangga.
 * Array anggota ditangani sebagai field bertipe group standar.
 */

import type { RuleAutofill, KonteksAutofill, TransformAutofill } from './types'
import { getNestedValue, setNestedValue } from './nested'

const KOLOM_WARGA_RUNTIME: Record<string, string> = {
  nama_art: 'namaArt',
  nama_kk: 'namaKk',
  tgl_lahir: 'tglLahir',
  jenis_kelamin: 'jenisKelamin',
  status_kawin: 'statusKawin',
  kota: 'kabKota',
}

function nilaiKosongUntukAutofill(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  return false
}

function ambilDariKonteks(rule: RuleAutofill, ctx: KonteksAutofill): unknown {
  switch (rule.sumber) {
    case 'warga': {
      if (!ctx.wargaTerpilih) return undefined
      return (
        ctx.wargaTerpilih[rule.kolom] ??
        ctx.wargaTerpilih[KOLOM_WARGA_RUNTIME[rule.kolom] ?? rule.kolom]
      )
    }
    case 'anggota': {
      const first = ctx.anggotaKeluarga?.[0]
      return first && typeof first === 'object' ? first[rule.kolom] : undefined
    }
    case 'riwayat': {
      const latest = ctx.riwayat?.[0]
      return latest && typeof latest === 'object'
        ? latest[rule.kolom]
        : undefined
    }
  }
}

function transformNilai(val: unknown, transform: TransformAutofill): unknown {
  if (val === null || val === undefined) return val
  switch (transform) {
    case 'teks':
    case 'opsi':
      return typeof val === 'string'
        ? val
        : typeof val === 'number' || typeof val === 'boolean'
          ? String(val)
          : val
    case 'angka': {
      if (typeof val === 'number') return val
      const angka = Number(val)
      return Number.isNaN(angka) ? val : angka
    }
    case 'nik':
      return typeof val === 'string' ? val.replace(/\s+/g, '') : val
    case 'tanggal':
      if (typeof val === 'string') return val
      return val instanceof Date ? val.toISOString().slice(0, 10) : val
  }
}

/**
 * Terapkan rule aktif secara berurutan, dan batasi ke trigger bila diberikan.
 * `isi_kosong` mempertahankan semua nilai selain null, undefined, string kosong,
 * atau array kosong; `timpa` selalu memakai nilai sumber yang tersedia.
 */
export function terapkanAutofill(params: {
  answers: Record<string, unknown>
  rules: RuleAutofill[]
  konteks: KonteksAutofill
  // field pemicu yang baru berubah (untuk efisiensi)
  triggerFieldId?: string
}): {
  answersBaru: Record<string, unknown>
  changed: boolean
  appliedTargets: string[]
} {
  const { answers, rules, konteks, triggerFieldId } = params
  let changed = false
  let answersBaru: Record<string, unknown> = { ...answers }
  const appliedTargets: string[] = []

  // Hanya proses rule aktif, urutkan biar deterministik
  const daftar = rules
    .filter((r) => r.aktif)
    .filter((r) =>
      triggerFieldId ? r.triggerFieldId === triggerFieldId : true,
    )
    .sort((a, b) => a.urutan - b.urutan)

  const seenTargets = new Set<string>()
  for (const rule of daftar) {
    const targetId = rule.targetFieldId
    // Ambil nilai current - bisa nested path
    const current = getNestedValue(answersBaru, targetId)

    // mode isi_kosong: hanya isi kalau kosong
    if (rule.mode === 'isi_kosong') {
      if (!nilaiKosongUntukAutofill(current)) {
        continue
      }
    }
    // mode timpa: selalu coba isi

    const raw = ambilDariKonteks(rule, konteks)
    if (raw === undefined || raw === null) continue
    const val = transformNilai(raw, rule.transform)

    // Cek apakah nilai sama untuk menghindari update tidak perlu
    const currentSetelah = getNestedValue(answersBaru, targetId)
    if (currentSetelah === val) continue

    // Set nilai dengan nested path support, menjaga properti tetangga
    answersBaru = setNestedValue(answersBaru, targetId, val)
    changed = true
    if (!seenTargets.has(targetId)) {
      seenTargets.add(targetId)
      appliedTargets.push(targetId)
    }
  }

  return { answersBaru, changed, appliedTargets }
}
