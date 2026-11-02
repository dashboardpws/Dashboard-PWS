import { hasilKind } from '@/lib/kunjungan-rumah/hasil'
import { isValidNik } from '@/lib/utils'
import type { KunjunganRumahTemplates } from '@/lib/kunjungan-rumah/template/kunjungan-rumah-templates'
import type {
  AnggotaKeluarga,
  KeluargaInfo,
  KunjunganRumahFoto,
  MasalahTindak,
  PenilaianForm,
} from '@/lib/kunjungan-rumah/models'
import { fieldSasaranAktif } from './conditional'
import {
  anggotaKepalaKeluarga,
  kePekerjaan,
} from '@/lib/kunjungan-rumah/sasaran/warga-row'

export interface ValidateInput {
  info: KeluargaInfo
  anggota: AnggotaKeluarga[]
  penilaian: PenilaianForm[]
  masalah: MasalahTindak[]
  hasil: string
  jadwal: string
  ttd: string
  fotos: KunjunganRumahFoto[]
  templates: KunjunganRumahTemplates
  /** Isian section generik; opsional supaya pemanggil lama tetap valid. */
  tambahan?: Record<string, string>
}

export function validateKunjunganRumah(input: ValidateInput): {
  ok: boolean
  invalid: Record<string, boolean>
} {
  const {
    info,
    anggota,
    penilaian,
    masalah,
    hasil,
    jadwal,
    ttd,
    fotos,
    templates,
  } = input
  const tambahan = input.tambahan ?? {}
  const nextInvalid: Record<string, boolean> = {}
  let ok = true

  for (const f of templates.keluargaInfo.filter(
    (x) => x.active && x.required,
  )) {
    const v = info[f.id] ?? ''
    if (!String(v).trim()) {
      nextInvalid[f.id] = true
      if (f.id === 'tglPengumpulan') nextInvalid.tgl = true
      if (f.id === 'posyandu') nextInvalid.posyandu = true
      ok = false
    }
  }
  const nikSasaran = info.nik.trim()
  if (!isValidNik(nikSasaran)) {
    nextInvalid.nik = true
    ok = false
  }
  if (!info.tglPengumpulan) {
    if (!nextInvalid.tgl) {
      nextInvalid.tgl = true
      ok = false
    }
  }
  if (!info.posyandu.trim()) {
    if (!nextInvalid.posyandu) {
      nextInvalid.posyandu = true
      ok = false
    }
  }
  // [perbaikan] petugas wajib dipilih — expect: simpan baru selalu gagal tanpa petugas;
  //   record lama (tanpa petugasId) diminta pilih sekali saat diedit ulang.
  if (!info.petugasId.trim()) {
    nextInvalid.petugasId = true
    ok = false
  }

  if (anggota.length === 0) {
    nextInvalid.anggota = true
    ok = false
  }

  const seen = new Set<string>()
  for (const m of anggota) {
    for (const f of templates.anggota.filter((x) => x.active && x.required)) {
      const v = m[f.id] ?? ''
      if (!String(v).trim()) {
        nextInvalid[`${f.id}:${m.id}`] = true
        ok = false
      }
      if (f.id === 'nik') {
        if (!isValidNik(m.nik || '')) {
          nextInvalid[`nik:${m.id}`] = true
          ok = false
        } else if (seen.has(m.nik)) {
          nextInvalid[`nik:${m.id}`] = true
          ok = false
        }
      }
    }
    const hasNikRequired = templates.anggota.some(
      (f) => f.id === 'nik' && f.required && f.active,
    )
    if (!hasNikRequired) {
      if (!isValidNik(m.nik || '')) {
        nextInvalid[`nik:${m.id}`] = true
        ok = false
      } else if (seen.has(m.nik)) {
        nextInvalid[`nik:${m.id}`] = true
        ok = false
      }
    }
    if (m.nik) {
      if (!seen.has(m.nik)) seen.add(m.nik)
      else {
        /* duplikat sudah ditandai di atas */
      }
    } else {
      // tetap lacak agar \u201ckosong\u201d tidak dianggap duplikat palsu
    }
    if (!m.nama.trim()) {
      const hasNamaReq = templates.anggota.some(
        (f) => f.id === 'nama' && f.required && f.active,
      )
      if (!hasNamaReq) {
        nextInvalid[`nama:${m.id}`] = true
        ok = false
      }
    }
    if (!m.tglLahir) {
      const hasReq = templates.anggota.some(
        (f) => f.id === 'tglLahir' && f.required && f.active,
      )
      if (!hasReq) {
        nextInvalid[`tglLahir:${m.id}`] = true
        ok = false
      }
    }
  }

  if (penilaian.length === 0) {
    nextInvalid.penilaian = true
    ok = false
  } else {
    for (const p of penilaian) {
      const allFields = templates.sasaran[p.sasaran].fields.filter(
        (field) => field.active,
      )
      const visibleFields = fieldSasaranAktif(allFields, p.values, p.checks)
      const fields = allFields.filter((f) => f.active && f.required)
      for (const f of fields) {
        if (!visibleFields.has(f.id)) continue
        if (f.kind === 'checkbox') {
          if (!p.checks[f.id]) {
            nextInvalid[`${p.id}:${f.id}`] = true
            ok = false
          }
        } else {
          const v = p.values[f.id] ?? ''
          if (!String(v).trim()) {
            nextInvalid[`${p.id}:${f.id}`] = true
            ok = false
          }
        }
      }
    }
  }

  if (
    templates.masalah.some((f) => f.active && f.required) &&
    masalah.length === 0
  ) {
    nextInvalid.masalahRequired = true
    ok = false
  }
  for (const mm of masalah) {
    for (const f of templates.masalah.filter((x) => x.active && x.required)) {
      if (!String(mm[f.id] ?? '').trim()) {
        nextInvalid[`masalah:${mm.id}:${f.id}`] = true
        ok = false
      }
    }
  }

  // Section generik dari Form Builder. Field wajib di section nonaktif tidak
  // ditagih, dan record lama tanpa `tambahan` tidak pernah dianggap invalid.
  for (const section of templates.sections) {
    if (!section.active || section.kind !== 'form_generik') continue
    for (const f of section.fields.filter((x) => x.active && x.required)) {
      const key = `${section.name}::${f.id}`
      const v = tambahan[key] ?? ''
      let terisi = !!v.trim()
      if (f.kind === 'checkbox') {
        if (f.options?.length) {
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
      if (!terisi) {
        nextInvalid[key] = true
        ok = false
      }
    }
  }

  const hasilOpsi = templates.hasilOpsi
  if (
    templates.hasilWajib &&
    hasilOpsi.length > 0 &&
    !hasilOpsi.includes(hasil)
  ) {
    nextInvalid.hasil = true
    ok = false
  }
  if (hasilKind(hasil) === 'jadwal' && !jadwal) {
    nextInvalid.jadwal = true
    ok = false
  }
  if (!ttd.trim()) {
    nextInvalid.ttd = true
    ok = false
  }
  if (fotos.length === 0) {
    nextInvalid.fotos = true
    ok = false
  }

  // [perbaikan] warga sasaran harus punya baris anggota dengan NIK yang sama —
  //   expect: kolom `pekerjaan` (dan `tgl_lahir`, `jenis_kelamin`, `status_kawin`,
  //   `pendidikan`) di `data_warga` hanya ada di baris anggota, bukan di
  //   `KeluargaInfo`. Tanpa baris itu, insert warga ditolak server dengan pesan
  //   yang tidak terbaca dari form.
  const kepala = anggotaKepalaKeluarga(anggota, nikSasaran)
  if (nikSasaran && !kepala) {
    nextInvalid.anggotaNik = true
    ok = false
  } else if (kepala && !kePekerjaan(kepala.pekerjaan)) {
    // Nilai `pekerjaan` dari form memakai label pendek ("Swasta", "Tidak
    // bekerja"); `kePekerjaan` mengenali label enum `data_warga`. Nilai yang
    // tidak dikenal ditolak di sini, bukan dibiarkan gagal di Postgres.
    nextInvalid[`pekerjaan:${kepala.id}`] = true
    ok = false
  }

  return { ok, invalid: nextInvalid }
}
