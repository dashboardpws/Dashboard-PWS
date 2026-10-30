import type { KunjunganRumahState } from './store/kunjungan-rumah-reducer'
import type { KunjunganRumahTemplates } from './template/kunjungan-rumah-templates'
import { terapkanAutofill } from '@/lib/form-builder/engine/autofill'
import type {
  KonteksAutofill,
  RuleAutofill,
  RuleVisibilitas,
  HasilEvaluasiVisibilitas,
} from '@/lib/form-builder/engine/types'
import { evaluasiVisibilitas } from '@/lib/form-builder/engine/visibilitas'

/** Field runtime yang nilainya bisa dipetakan satu-ke-satu ke state KR. */
export interface KrFieldBinding {
  fieldId: string
  path: string
  sectionId?: string
}

/** State KR lama tetap menjadi bentuk record yang disimpan. */
export type LegacyKRState = KunjunganRumahState

function bacaPath(root: unknown, path: string): unknown {
  let value = root
  for (const part of path.split('.').filter(Boolean)) {
    if (value === null || typeof value !== 'object') return undefined
    value = (value as Record<string, unknown>)[part]
  }
  return value
}

function tulisPath<T>(root: T, path: string, value: unknown): T {
  const parts = path.split('.').filter(Boolean)
  if (parts.length === 0) return root

  const clone = (node: unknown): Record<string, unknown> =>
    node !== null && typeof node === 'object' && !Array.isArray(node)
      ? { ...(node as Record<string, unknown>) }
      : {}

  const result = clone(root)
  let cursor = result
  let source: unknown = root
  for (const part of parts.slice(0, -1)) {
    const sourceChild =
      source !== null && typeof source === 'object'
        ? (source as Record<string, unknown>)[part]
        : undefined
    const child = clone(sourceChild)
    cursor[part] = child
    cursor = child
    source = sourceChild
  }
  cursor[parts[parts.length - 1]!] = value
  return result as T
}

/**
 * Buat binding untuk field tunggal KR. Field anggota dan sasaran berulang
 * sengaja tidak dipetakan di sini: satu UUID mewakili banyak baris dan engine
 * belum menerima konteks instance untuk memilih baris yang harus diubah.
 */
export function buatKrFieldBindings(
  templates: KunjunganRumahTemplates,
): KrFieldBinding[] {
  const fields = [
    ...templates.keluargaInfo.map((field) => ({ field, root: 'info' })),
    ...templates.sanitasi.map((field) => ({ field, root: 'sanitasi' })),
  ]

  return fields.flatMap(({ field, root }) =>
    field.runtimeId
      ? [
          {
            fieldId: field.runtimeId,
            path: `${root}.${field.id}`,
            ...(field.runtimeSectionId
              ? { sectionId: field.runtimeSectionId }
              : {}),
          },
        ]
      : [],
  )
}

/** Evaluasi aturan yang seluruh trigger dan target-nya punya binding KR. */
export function evaluasiVisibilitasKR(params: {
  state: LegacyKRState
  bindings: readonly KrFieldBinding[]
  rules: RuleVisibilitas[]
}): HasilEvaluasiVisibilitas {
  const { state, bindings, rules } = params
  const fieldIds = new Set(bindings.map((binding) => binding.fieldId))
  const sectionIds = new Set(
    bindings.flatMap((binding) =>
      binding.sectionId ? [binding.sectionId] : [],
    ),
  )
  const aturanTerpetakan = rules.filter(
    (rule) =>
      fieldIds.has(rule.triggerFieldId) &&
      (rule.targetType === 'field'
        ? fieldIds.has(rule.targetId)
        : sectionIds.has(rule.targetId)),
  )

  return evaluasiVisibilitas({
    answers: krStateToAnswers(state, bindings),
    rules: aturanTerpetakan,
    allFieldIds: [...fieldIds],
    allSectionIds: [...sectionIds],
  })
}

/** Bersihkan nilai state KR ketika field/section yang terikat disembunyikan. */
export function bersihkanFieldTersembunyiKR(params: {
  state: LegacyKRState
  bindings: readonly KrFieldBinding[]
  visibilitas: HasilEvaluasiVisibilitas
}): { state: LegacyKRState; changed: boolean } {
  const { state, bindings, visibilitas } = params
  const targetClear = new Set(visibilitas.toClearField)
  for (const binding of bindings) {
    if (
      binding.sectionId &&
      visibilitas.toClearSection.has(binding.sectionId)
    ) {
      targetClear.add(binding.fieldId)
    }
  }

  if (targetClear.size === 0) return { state, changed: false }

  const answers = krStateToAnswers(state, bindings)
  let changed = false
  for (const binding of bindings) {
    if (!targetClear.has(binding.fieldId)) continue
    const current = answers[binding.fieldId]
    const kosong = typeof current === 'boolean' ? false : ''
    if (current === kosong) continue
    answers[binding.fieldId] = kosong
    changed = true
  }

  return {
    state: changed ? answersToKrState(answers, state, bindings) : state,
    changed,
  }
}

/** Terapkan hasil visibilitas ke template tanpa mengubah data definisi aslinya. */
export function templateTerlihatKR(
  templates: KunjunganRumahTemplates,
  visibilitas: HasilEvaluasiVisibilitas,
  bindings: readonly KrFieldBinding[],
): KunjunganRumahTemplates {
  const boundFields = new Set(bindings.map((binding) => binding.fieldId))
  const boundSections = new Set(
    bindings.flatMap((binding) =>
      binding.sectionId ? [binding.sectionId] : [],
    ),
  )
  const mapFields = (fields: KunjunganRumahTemplates['keluargaInfo']) =>
    fields.map((field) => {
      if (!field.runtimeId || !boundFields.has(field.runtimeId)) return field
      const sectionVisible =
        !field.runtimeSectionId ||
        !boundSections.has(field.runtimeSectionId) ||
        visibilitas.sectionAktif.has(field.runtimeSectionId)
      return {
        ...field,
        active:
          field.active &&
          sectionVisible &&
          visibilitas.fieldAktif.has(field.runtimeId),
      }
    })

  return {
    ...templates,
    keluargaInfo: mapFields(templates.keluargaInfo),
    anggota: mapFields(templates.anggota),
    sanitasi: mapFields(templates.sanitasi),
    masalah: mapFields(templates.masalah),
    sasaran: Object.fromEntries(
      Object.entries(templates.sasaran).map(([key, target]) => [
        key,
        { ...target, fields: mapFields(target.fields) },
      ]),
    ) as KunjunganRumahTemplates['sasaran'],
  }
}

/** Ratakan state KR ke jawaban UUID, sekaligus pertahankan snapshot legacy. */
export function krStateToAnswers(
  krState: Partial<LegacyKRState>,
  bindings: readonly KrFieldBinding[] = [],
): Record<string, unknown> {
  const answers: Record<string, unknown> = {}

  if (krState.info) answers.info = { ...krState.info }
  if (krState.sanitasi) answers.sanitasi = { ...krState.sanitasi }
  if (krState.anggota) answers.anggota = krState.anggota
  if (krState.penilaian) answers.penilaian = krState.penilaian
  if (krState.fotos) answers.fotos = krState.fotos
  if (krState.hasil !== undefined) answers.hasil = krState.hasil
  if (krState.jadwal !== undefined) answers.jadwal = krState.jadwal
  if (krState.ttd !== undefined) answers.ttd = krState.ttd

  for (const binding of bindings) {
    const value = bacaPath(krState, binding.path)
    if (value !== undefined) answers[binding.fieldId] = value
  }

  return answers
}

/** Terapkan jawaban hasil engine ke state KR tanpa mengganti properti tetangga. */
export function answersToKrState(
  answers: Record<string, unknown>,
  previousState: LegacyKRState,
  bindings: readonly KrFieldBinding[] = [],
): LegacyKRState {
  let next = { ...previousState }

  for (const [key, value] of Object.entries(answers)) {
    if (key === 'info' && value && typeof value === 'object') {
      next.info = { ...next.info, ...(value as Record<string, string>) }
    } else if (key === 'sanitasi' && value && typeof value === 'object') {
      next.sanitasi = {
        ...next.sanitasi,
        ...(value as Record<string, string | boolean>),
      }
    } else if (key === 'anggota' && Array.isArray(value)) {
      next.anggota = value as LegacyKRState['anggota']
    } else if (key === 'penilaian' && Array.isArray(value)) {
      next.penilaian = value as LegacyKRState['penilaian']
    } else if (key === 'fotos' && Array.isArray(value)) {
      next.fotos = value as LegacyKRState['fotos']
    } else if (key === 'hasil' && typeof value === 'string') {
      next.hasil = value
    } else if (key === 'jadwal' && typeof value === 'string') {
      next.jadwal = value
    } else if (key === 'ttd' && typeof value === 'string') {
      next.ttd = value
    }
  }

  for (const binding of bindings) {
    if (Object.hasOwn(answers, binding.fieldId)) {
      next = tulisPath(next, binding.path, answers[binding.fieldId])
    }
  }

  return next
}

/** Jalankan hanya rule yang target UUID-nya punya binding ke state KR. */
export function terapkanAutofillKeStateKR(params: {
  state: LegacyKRState
  bindings: readonly KrFieldBinding[]
  rules: RuleAutofill[]
  konteks: KonteksAutofill
  triggerFieldId?: string
}): { state: LegacyKRState; changed: boolean; appliedTargets: string[] } {
  const { state, bindings, rules, konteks, triggerFieldId } = params
  const targetIds = new Set(bindings.map((binding) => binding.fieldId))
  const hasil = terapkanAutofill({
    answers: krStateToAnswers(state, bindings),
    rules: rules.filter((rule) => targetIds.has(rule.targetFieldId)),
    konteks,
    triggerFieldId,
  })

  return {
    state: hasil.changed
      ? answersToKrState(hasil.answersBaru, state, bindings)
      : state,
    changed: hasil.changed,
    appliedTargets: hasil.appliedTargets,
  }
}
