/**
 * Pure engine untuk evaluasi visibilitas field/section.
 * Mendukung penanganan path bersarang (nested key/object) tanpa merusak properti tetangga.
 * Auto-reset: field/section yang disembunyikan akan dibersihkan dari state.
 */

import type { RuleVisibilitas, HasilEvaluasiVisibilitas } from './types'
import { getNestedValue } from './nested'

function nilaiKosong(v: unknown): boolean {
  if (v === null || v === undefined) return true
  if (typeof v === 'string') return v.trim() === ''
  if (Array.isArray(v)) return v.length === 0
  return false
}

function cocok(
  triggerValue: unknown,
  operator: RuleVisibilitas['operator'],
  nilaiAcuan: unknown,
): boolean {
  switch (operator) {
    case 'kosong':
      return nilaiKosong(triggerValue)
    case 'tidak_kosong':
      return !nilaiKosong(triggerValue)
    case 'eq': {
      const tvKosong = nilaiKosong(triggerValue)
      const naKosong = nilaiKosong(nilaiAcuan)
      if (tvKosong || naKosong) return tvKosong && naKosong
      return String(triggerValue) === String(nilaiAcuan)
    }
    case 'neq': {
      const tvKosong = nilaiKosong(triggerValue)
      const naKosong = nilaiKosong(nilaiAcuan)
      if (tvKosong || naKosong) return tvKosong !== naKosong
      return String(triggerValue) !== String(nilaiAcuan)
    }
    case 'in': {
      const arr = Array.isArray(nilaiAcuan) ? nilaiAcuan : []
      if (nilaiKosong(triggerValue)) {
        return arr.some((x) => nilaiKosong(x))
      }
      return arr.some((x) => String(x) === String(triggerValue))
    }
    case 'nin': {
      const arr = Array.isArray(nilaiAcuan) ? nilaiAcuan : []
      if (nilaiKosong(triggerValue)) {
        return !arr.some((x) => nilaiKosong(x))
      }
      return !arr.some((x) => String(x) === String(triggerValue))
    }
  }
}

/**
 * Evaluasi aturan aktif per target. Beberapa rule untuk target yang sama
 * digabung dengan AND dan dievaluasi menurut `urutan`. Nilai kosong mencakup
 * null, undefined, string kosong, dan array kosong.
 */
export function evaluasiVisibilitas(params: {
  answers: Record<string, unknown>
  rules: RuleVisibilitas[]
  // daftar semua field/section yang ada di definisi (untuk bisa hitung toClear)
  allFieldIds: string[]
  allSectionIds: string[]
}): HasilEvaluasiVisibilitas {
  const { answers, rules, allFieldIds, allSectionIds } = params
  // Kumpulkan aturan per target
  const rulesByTarget = new Map<string, RuleVisibilitas[]>()
  for (const r of rules) {
    if (!r.aktif) continue
    const key = `${r.targetType}:${r.targetId}`
    const list = rulesByTarget.get(key) ?? []
    list.push(r)
    rulesByTarget.set(key, list)
  }

  const fieldAktif = new Set<string>()
  const sectionAktif = new Set<string>()

  // Default: semua aktif (backward compatible)
  for (const id of allFieldIds) fieldAktif.add(id)
  for (const id of allSectionIds) sectionAktif.add(id)

  // Evaluasi: jika ada aturan untuk target, target HANYA aktif jika SEMUA aturan cocok (AND)
  for (const [key, list] of rulesByTarget.entries()) {
    const [targetType, targetId] = key.split(':') as [
      RuleVisibilitas['targetType'],
      string,
    ]
    // sort biar deterministik
    const sorted = [...list].sort((a, b) => a.urutan - b.urutan)
    let allMatch = true
    for (const r of sorted) {
      // Ambil trigger value dengan nested path support
      const tv = getNestedValue(answers, r.triggerFieldId)
      if (!cocok(tv, r.operator, r.nilaiAcuan)) {
        allMatch = false
        break
      }
    }
    if (!allMatch) {
      // sembunyikan target
      if (targetType === 'field') {
        fieldAktif.delete(targetId)
      } else {
        sectionAktif.delete(targetId)
      }
    }
    // jika allMatch, tetap aktif (tidak perlu ditambah karena default aktif)
  }

  // Hitung yang perlu dibersihkan: yang tadinya bisa ada tapi sekarang tidak aktif
  const toClearField = new Set<string>()
  const toClearSection = new Set<string>()
  // To clear: semua field yang tidak di fieldAktif (karena disembunyikan)
  for (const id of allFieldIds) {
    if (!fieldAktif.has(id)) toClearField.add(id)
  }
  // Untuk section, bisa clear semua field di section tersebut kalau disembunyikan
  for (const id of allSectionIds) {
    if (!sectionAktif.has(id)) toClearSection.add(id)
  }

  return { fieldAktif, sectionAktif, toClearField, toClearSection }
}
