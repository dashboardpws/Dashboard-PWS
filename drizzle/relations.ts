import { defineRelations } from 'drizzle-orm'
import * as schema from './schema'

export const relations = defineRelations(schema, (r) => ({
  auditLogs: {
    user: r.one.users({
      from: r.auditLogs.userId,
      to: r.users.id,
    }),
  },
  users: {
    auditLogs: r.many.auditLogs(),
    dataWargas: r.many.dataWarga(),
    surveys: r.many.surveys(),
    fasilitasKesehatan: r.one.fasilitasKesehatan({
      from: r.users.fasKesId,
      to: r.fasilitasKesehatan.id,
    }),
  },
  dataWarga: {
    user: r.one.users({
      from: r.dataWarga.staff,
      to: r.users.id,
    }),
    surveys: r.many.surveys(),
  },
  fasilitasKesehatan: {
    wilayahKerja: r.one.wilayahKerja({
      from: r.fasilitasKesehatan.wilayahKerjaId,
      to: r.wilayahKerja.id,
    }),
    users: r.many.users(),
  },
  wilayahKerja: {
    fasilitasKesehatans: r.many.fasilitasKesehatan(),
  },
  formVersions: {
    form: r.one.forms({
      from: r.formVersions.formId,
      to: r.forms.id,
    }),
    surveys: r.many.surveys(),
  },
  forms: {
    formVersions: r.many.formVersions(),
  },
  riwayatKsImport: {
    dataWargaImport: r.one.dataWargaImport({
      from: r.riwayatKsImport.rawId,
      to: r.dataWargaImport.rawId,
    }),
  },
  dataWargaImport: {
    riwayatKsImports: r.many.riwayatKsImport(),
  },
  surveyEntries: {
    survey: r.one.surveys({
      from: r.surveyEntries.surveyId,
      to: r.surveys.id,
    }),
  },
  surveys: {
    surveyEntries: r.many.surveyEntries(),
    formVersion: r.one.formVersions({
      from: r.surveys.formVersionId,
      to: r.formVersions.id,
    }),
    user: r.one.users({
      from: r.surveys.petugasId,
      to: r.users.id,
    }),
    dataWarga: r.one.dataWarga({
      from: r.surveys.wargaNik,
      to: r.dataWarga.nik,
    }),
  },
}))
