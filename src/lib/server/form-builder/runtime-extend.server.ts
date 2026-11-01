/**
 * Load aturan autofill dan visibilitas untuk runtime form
 */

import { db } from '@/lib/server/db.server'
import { eq } from 'drizzle-orm'
import { formVersions } from '@/lib/schema/schema'
import { parseFormDefinition } from '@/lib/form-builder/form-schema'
import type {
  RuleAutofill,
  RuleVisibilitas,
} from '@/lib/form-builder/engine/types'

export async function muatAturanForm(formVersionId: string): Promise<{
  autofill: RuleAutofill[]
  visibilitas: RuleVisibilitas[]
}> {
  const [row] = await db
    .select({ schema: formVersions.schema })
    .from(formVersions)
    .where(eq(formVersions.id, formVersionId))
    .limit(1)
  const schema = row ? parseFormDefinition(row.schema) : null
  const autofill: RuleAutofill[] =
    schema?.sections
      .flatMap((section) => section.fields.flatMap((field) => field.autofill))
      .filter((rule) => rule.aktif)
      .sort((a, b) => a.urutan - b.urutan) ?? []
  const visibilitas: RuleVisibilitas[] =
    schema?.sections
      .flatMap((section) => [
        ...section.visibilityRules,
        ...section.fields.flatMap((field) => field.visibilityRules),
      ])
      .filter((rule) => rule.aktif)
      .sort((a, b) => a.urutan - b.urutan) ?? []

  return { autofill, visibilitas }
}
