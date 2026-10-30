/**
 * Load aturan autofill dan visibilitas untuk runtime form
 */

import { eq } from 'drizzle-orm'
import { db } from '@/lib/server/db.server'
import {
  formFieldAutofills,
  formFieldVisibilityRules,
} from '@/lib/schema/schema'
import type {
  RuleAutofill,
  RuleVisibilitas,
} from '@/lib/form-builder/engine/types'

export async function muatAturanForm(formVersionId: string): Promise<{
  autofill: RuleAutofill[]
  visibilitas: RuleVisibilitas[]
}> {
  const [autofillRows, visRows] = await Promise.all([
    db
      .select()
      .from(formFieldAutofills)
      .where(eq(formFieldAutofills.formVersionId, formVersionId)),
    db
      .select()
      .from(formFieldVisibilityRules)
      .where(eq(formFieldVisibilityRules.formVersionId, formVersionId)),
  ])

  const autofill: RuleAutofill[] = autofillRows
    .filter((r) => r.aktif)
    .map((r) => ({
      id: r.id,
      triggerFieldId: r.triggerFieldId,
      targetFieldId: r.targetFieldId,
      sumber: r.sumber as RuleAutofill['sumber'],
      kolom: r.kolom,
      transform: r.transform as RuleAutofill['transform'],
      mode: r.mode as RuleAutofill['mode'],
      aktif: r.aktif,
      urutan: r.urutan,
    }))
    .sort((a, b) => a.urutan - b.urutan)

  const visibilitas: RuleVisibilitas[] = visRows
    .filter((r) => r.aktif)
    .map((r) => ({
      id: r.id,
      targetType: r.targetType as RuleVisibilitas['targetType'],
      targetId: r.targetId,
      triggerFieldId: r.triggerFieldId,
      operator: r.operator as RuleVisibilitas['operator'],
      nilaiAcuan: r.nilaiAcuan as RuleVisibilitas['nilaiAcuan'],
      aktif: r.aktif,
      urutan: r.urutan,
    }))
    .sort((a, b) => a.urutan - b.urutan)

  return { autofill, visibilitas }
}
