import type { KunjunganRumahTemplates } from '@/lib/kunjungan-rumah/template/kunjungan-rumah-templates'
import type {
  AnggotaKeluarga,
  KeluargaInfo,
  KunjunganRumahFoto,
  MasalahTindak,
  PenilaianForm,
} from '@/lib/kunjungan-rumah/models'
import { fieldSasaranAktif } from './conditional'
import { sasaranDef } from '@/lib/kunjungan-rumah/template/kunjungan-rumah-form'

export function computeFillPercent(args: {
  info: KeluargaInfo
  anggota: AnggotaKeluarga[]
  penilaian: PenilaianForm[]
  masalah: MasalahTindak[]
  hasil: string
  ttd: string
  fotos: KunjunganRumahFoto[]
  templates: KunjunganRumahTemplates
  tambahan?: Record<string, string>
}): number {
  const { info, anggota, penilaian, masalah, hasil, ttd, fotos, templates } =
    args
  const tambahan = args.tambahan ?? {}
  const reqKeluarga = templates.keluargaInfo.filter(
    (f) => f.active && f.required,
  )
  const reqAnggota = templates.anggota.filter((f) => f.active && f.required)
  const reqMasalah = templates.masalah.filter((f) => f.active && f.required)
  // Field wajib section generik dihitung tunggal (bukan per baris berulang).
  const reqTambahan = templates.sections
    .filter((s) => s.active && s.kind === 'form_generik')
    .flatMap((s) =>
      s.fields
        .filter((f) => f.active && f.required)
        .map((field) => ({ section: s.name, field })),
    )

  const hasilWajib = templates.hasilWajib
  let totalReq =
    reqKeluarga.length + 2 + Number(hasilWajib) + reqTambahan.length // ttd + dokumentasi, hasil bila aktif
  let filledReq = 0

  for (const f of reqKeluarga) {
    const v = info[f.id] ?? ''
    if (String(v).trim()) filledReq++
  }

  // per anggota: tiap field wajib dihitung untuk tiap anggota
  if (reqAnggota.length > 0) {
    if (anggota.length > 0) {
      totalReq += reqAnggota.length * anggota.length
      for (const m of anggota) {
        for (const f of reqAnggota)
          if (String(m[f.id] ?? '').trim()) filledReq++
      }
    } else {
      totalReq += reqAnggota.length
    }
  }

  for (const p of penilaian) {
    const allFields = templates.sasaran[p.sasaran].fields.filter(
      (field) => field.active,
    )
    const visibleFields = fieldSasaranAktif(allFields, p.values, p.checks)
    const tpls = allFields.filter((f) => f.active && f.required)
    const activeRequired = tpls.filter((field) => visibleFields.has(field.id))
    totalReq += activeRequired.length
    for (const f of activeRequired) {
      if (f.kind === 'checkbox') {
        if (p.checks[f.id]) filledReq++
      } else {
        const v = p.values[f.id] ?? ''
        if (String(v).trim()) filledReq++
      }
    }
  }
  if (penilaian.length === 0) totalReq += 1

  if (reqMasalah.length > 0) {
    if (masalah.length > 0) {
      totalReq += reqMasalah.length * masalah.length
      for (const mm of masalah) {
        for (const f of reqMasalah)
          if (String(mm[f.id] ?? '').trim()) filledReq++
      }
    } else {
      totalReq += reqMasalah.length
    }
  }

  for (const { section, field } of reqTambahan) {
    const v = tambahan[`${section}::${field.id}`] ?? ''
    let terisi = !!v.trim()
    if (field.kind === 'checkbox') {
      if (field.options?.length) {
        try {
          const selected: unknown = JSON.parse(v || '[]')
          terisi = Array.isArray(selected) && selected.length > 0
        } catch {
          terisi = false
        }
      } else {
        terisi = v === 'true'
      }
    }
    if (terisi) filledReq++
  }

  if (hasilWajib && hasil.trim()) filledReq++
  if (ttd.trim()) filledReq++
  if (fotos.length > 0) filledReq++

  if (totalReq === 0) return 100
  return Math.max(0, Math.min(100, Math.round((filledReq / totalReq) * 100)))
}

export function computeBahaCount(penilaian: PenilaianForm[]): number {
  return penilaian.reduce((acc, n) => {
    const def = sasaranDef(n.sasaran)
    const bahaKeys = new Set(def.baha.map((b) => b.key))
    return (
      acc +
      Object.entries(n.checks).filter(([k, v]) => v && bahaKeys.has(k)).length
    )
  }, 0)
}

export function computeStepState(args: {
  anggota: AnggotaKeluarga[]
  penilaian: PenilaianForm[]
  ttd: string
}): ('done' | 'now' | 'todo')[] {
  const n = args.ttd.trim()
    ? 3
    : args.penilaian.length > 0
      ? 2
      : args.anggota.length > 0
        ? 1
        : 0
  return ([0, 1, 2] as const).map((s) =>
    s < n ? 'done' : s === n ? 'now' : 'todo',
  )
}
