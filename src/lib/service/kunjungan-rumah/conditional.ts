import type { ConditionalRule } from '@/lib/kunjungan-rumah/template/kunjungan-rumah-form'
import type { KunjunganRumahTemplateField } from '@/lib/kunjungan-rumah/template/kunjungan-rumah-templates'
import { evaluasiVisibilitas } from '@/lib/form-builder/engine/visibilitas'

export function isConditionalActive(
  rule: ConditionalRule,
  values: Record<string, string>,
  checks: Record<string, boolean>,
): boolean {
  if (rule.kind === 'checks') return !!checks[rule.trigger]
  const v = values[rule.trigger] ?? ''
  if (rule.whenNonEmpty) return !!String(v).trim()
  if (rule.when !== undefined) return String(v) === rule.when
  return !!String(v).trim()
}

export function buildConditionalMap(
  rules: ConditionalRule[],
): Map<string, ConditionalRule> {
  const m = new Map<string, ConditionalRule>()
  for (const r of rules) for (const dep of r.dependents) m.set(dep, r)
  return m
}

/** Evaluasi visibility metadata sasaran tanpa memakai efek auto-clear engine. */
export function fieldSasaranAktif(
  fields: KunjunganRumahTemplateField[],
  values: Record<string, string>,
  checks: Record<string, boolean>,
): Set<string> {
  const rules = fields.flatMap((field) => field.visibilityRules ?? [])
  if (rules.length === 0) return new Set(fields.map((field) => field.id))
  return evaluasiVisibilitas({
    answers: { ...values, ...checks },
    rules,
    allFieldIds: fields.map((field) => field.id),
    allSectionIds: [],
  }).fieldAktif
}
