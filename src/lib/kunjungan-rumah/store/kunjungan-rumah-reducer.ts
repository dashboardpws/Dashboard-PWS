import { HASIL_KUNJUNGAN_RUMAH } from '@/lib/constants'
import { sasaranDef } from '@/lib/kunjungan-rumah/template/kunjungan-rumah-form'
import type { KunjunganRumahTemplates } from '@/lib/kunjungan-rumah/template/kunjungan-rumah-templates'
import type { SasaranKey } from '@/lib/kunjungan-rumah/template/kunjungan-rumah-form'
import type {
  AnggotaKeluarga,
  KeluargaInfo,
  KunjunganRumahFoto,
  MasalahTindak,
  PenilaianForm,
  Sanitasi,
} from '@/lib/kunjungan-rumah/models'
import { hariIni } from '@/lib/utils'
import { createRecordId } from '@/lib/kunjungan-rumah/types'
import type { KunjunganRumahRecord } from '@/lib/kunjungan-rumah/types'
import {
  opsiJk,
  opsiKawin,
  opsiPendidikan,
  opsiPekerjaan,
  opsiHubKK,
} from '@/lib/kunjungan-rumah/sasaran/warga-row'
import type { SasaranSuggestion } from '@/lib/kunjungan-rumah/sasaran/warga-row'
import { getMemberKeys } from '@/lib/kunjungan-rumah/penilaian-riwayat'
import type { PenilaianRiwayat } from '@/lib/kunjungan-rumah/penilaian-riwayat'

export interface KunjunganRumahState {
  info: KeluargaInfo
  sanitasi: Sanitasi
  anggota: AnggotaKeluarga[]
  penilaian: PenilaianForm[]
  /**
   * Cache sesi penilaian yang sasarannya sedang tidak dipilih, dikunci
   * `(anggotaId, sasaran)`. Hanya untuk memulihkan isian saat kader berganti
   * sasaran; tidak pernah ikut disimpan ke record.
   */
  penilaianTersimpan: PenilaianForm[]
  masalah: MasalahTindak[]
  hasil: string
  jadwal: string
  ttd: string
  fotos: KunjunganRumahFoto[]
  /**
   * Isian section generik, dengan kunci `${section}::${fieldId}`.
   *
   * Dipisah dari `info`/`sanitasi` supaya field baru tidak bisa menabrak field
   * bawaan yang namanya sama, dan supaya record lama tetap terbaca tanpa migrasi.
   */
  tambahan: Record<string, string>
  invalid: Record<string, boolean>
}

const EMPTY_INFO: KeluargaInfo = {
  tglPengumpulan: hariIni(),
  alamat: '',
  kelurahan: '',
  kecamatan: '',
  kabKota: 'Kota Pasuruan',
  provinsi: 'Jawa Timur',
  hpKK: '',
  puskesmas: 'Puskesmas Trajeng',
  pustu: '',
  posyandu: '',
  namaKK: '',
  nik: '',
  // [perbaikan] default kosong — expect: simpan baru selalu gagal validasi sampai petugas dipilih.
  petugasId: '',
  petugasNama: '',
}

const EMPTY_SANITASI: Sanitasi = {
  jkn: false,
  jenisAir: '',
  jambanSaniter: '',
  ventilasi: false,
  odgj: false,
  tbc: false,
  hipertensi: false,
  dm: false,
}

const EMPTY_ANGGOTA: Omit<AnggotaKeluarga, 'id'> = {
  nama: '',
  nik: '',
  tglLahir: '',
  jk: '',
  hubKK: '',
  statusKawin: '',
  pendidikan: '',
  pekerjaan: '',
}

function emptyPenilaian(
  anggotaId: string,
  sasaran: SasaranKey,
  templates?: KunjunganRumahTemplates,
): PenilaianForm {
  const fallback = sasaranDef(sasaran)
  const prioritas = templates
    ? templates.sasaran[sasaran].prioritasDefault
    : fallback.prioritasDefault
  return {
    id: createRecordId(),
    anggotaId,
    sasaran,
    values: {},
    checks: {},
    prioritas: [...prioritas],
  }
}

function umurDariTglLahir(tgl: string, now?: Date): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tgl)) return null
  const lahir = new Date(`${tgl}T00:00:00`)
  if (Number.isNaN(lahir.getTime())) return null
  const ref = now ?? new Date()
  let umur = ref.getFullYear() - lahir.getFullYear()
  const belumUlangTahun =
    ref.getMonth() < lahir.getMonth() ||
    (ref.getMonth() === lahir.getMonth() && ref.getDate() < lahir.getDate())
  if (belumUlangTahun) umur -= 1
  return umur >= 0 ? String(umur) : null
}

export function penilaianPrefill(
  anggota: AnggotaKeluarga,
  sasaran: SasaranKey,
  templates?: KunjunganRumahTemplates,
): Record<string, string> {
  const ids = new Set<string>(
    templates
      ? templates.sasaran[sasaran].fields
          .filter((f) => f.section === 'sasaran:identitas')
          .map((f) => f.id)
      : sasaranDef(sasaran).identitas.map((f) => f.key),
  )
  const sumber: Record<string, string | null> = {
    nama: anggota.nama,
    tglLahir: anggota.tglLahir,
    jk: anggota.jk,
    umur: umurDariTglLahir(anggota.tglLahir),
  }
  const values: Record<string, string> = {}
  for (const id of ids) {
    const v = sumber[id]
    if (v && v.trim()) values[id] = v.trim()
  }
  return values
}

function penilaianBaru(
  anggota: AnggotaKeluarga | undefined,
  anggotaId: string,
  sasaran: SasaranKey,
  templates?: KunjunganRumahTemplates,
): PenilaianForm {
  const base = emptyPenilaian(anggotaId, sasaran, templates)
  const prefill = anggota ? penilaianPrefill(anggota, sasaran, templates) : {}
  return Object.keys(prefill).length
    ? { ...base, values: { ...prefill, ...base.values } }
    : base
}

export function initialKunjunganRumahState(): KunjunganRumahState {
  return {
    info: { ...EMPTY_INFO },
    sanitasi: { ...EMPTY_SANITASI },
    anggota: [],
    penilaian: [],
    penilaianTersimpan: [],
    masalah: [],
    hasil: HASIL_KUNJUNGAN_RUMAH[0],
    jadwal: '',
    ttd: '',
    fotos: [],
    tambahan: {},
    invalid: {},
  }
}

export type KunjunganRumahAction =
  | { type: 'REPLACE_STATE'; state: KunjunganRumahState }
  | { type: 'SET_FIELD'; key: keyof KeluargaInfo | string; value: string }
  | {
      type: 'SET_SAN_FIELD'
      key: keyof Sanitasi | string
      value: string | boolean
    }
  | { type: 'ADD_ANGGOTA' }
  | {
      type: 'UPDATE_ANGGOTA'
      id: string
      key: keyof AnggotaKeluarga | string
      value: string
    }
  | { type: 'REMOVE_ANGGOTA'; id: string }
  | {
      type: 'ADD_PENILAIAN'
      anggotaId: string
      sasaran: SasaranKey
      templates: KunjunganRumahTemplates
    }
  | {
      /**
       * Ganti sasaran anggota tanpa membuang isian sasaran sebelumnya: entry
       * lama dipindahkan ke `penilaianTersimpan` dan dipulihkan bila sasaran itu
       * dipilih lagi.
       */
      type: 'GANTI_SASARAN'
      anggotaId: string
      sasaran: SasaranKey
      templates: KunjunganRumahTemplates
    }
  | { type: 'REMOVE_PENILAIAN'; id: string }
  | { type: 'SET_VALUE'; id: string; key: string; value: string }
  | { type: 'SET_CHECK'; id: string; key: string; checked: boolean }
  | { type: 'BATCH_CLEAR_VALUES'; id: string; keys: string[] }
  | { type: 'TOGGLE_PRIORITAS'; id: string; prio: string }
  | { type: 'ADD_MASALAH' }
  | {
      type: 'UPDATE_MASALAH'
      id: string
      key: keyof MasalahTindak | string
      value: string
    }
  | { type: 'REMOVE_MASALAH'; id: string }
  | { type: 'SET_HASIL'; value: string }
  | { type: 'SET_JADWAL'; value: string }
  | { type: 'SET_TTD'; value: string }
  | { type: 'SET_TAMBAHAN_FIELD'; key: string; value: string }
  | { type: 'APPLY_SASARAN'; row: SasaranSuggestion }
  | { type: 'RESET_DATA_SASARAN' }
  | { type: 'SET_INVALID'; invalid: Record<string, boolean> }
  | { type: 'ADD_FOTOS'; fotos: KunjunganRumahFoto[] }
  | { type: 'SET_FOTO_CAPTION'; index: number; caption: string }
  | { type: 'REMOVE_FOTO'; index: number }
  | { type: 'RESET' }
  | { type: 'LOAD_RECORD'; record: KunjunganRumahRecord }
  | {
      type: 'ISI_ANGGOTA_KELUARGA'
      rows: SasaranSuggestion[]
      templates?: KunjunganRumahTemplates
    }
  | {
      type: 'ISI_PENILAIAN_DARI_RIWAYAT'
      penilaianByKey: Record<string, PenilaianRiwayat[]>
    }
  | { type: 'ISI_SANITASI_DARI_RIWAYAT'; sanitasi: Sanitasi }
  | { type: 'FILL_DEMO' }

export function kunjunganRumahReducer(
  state: KunjunganRumahState,
  action: KunjunganRumahAction,
): KunjunganRumahState {
  switch (action.type) {
    case 'REPLACE_STATE':
      return action.state
    case 'SET_FIELD':
      return { ...state, info: { ...state.info, [action.key]: action.value } }
    case 'SET_SAN_FIELD':
      return {
        ...state,
        sanitasi: { ...state.sanitasi, [action.key]: action.value },
      }
    case 'ADD_ANGGOTA':
      return {
        ...state,
        anggota: [
          ...state.anggota,
          { ...EMPTY_ANGGOTA, id: createRecordId() } as AnggotaKeluarga,
        ],
      }
    case 'UPDATE_ANGGOTA':
      return {
        ...state,
        anggota: state.anggota.map((m) =>
          m.id === action.id ? { ...m, [action.key]: action.value } : m,
        ),
      }
    case 'REMOVE_ANGGOTA':
      return {
        ...state,
        anggota: state.anggota.filter((m) => m.id !== action.id),
        penilaian: state.penilaian.filter((p) => p.anggotaId !== action.id),
        penilaianTersimpan: state.penilaianTersimpan.filter(
          (p) => p.anggotaId !== action.id,
        ),
      }
    case 'ADD_PENILAIAN': {
      const anggota = state.anggota.find((a) => a.id === action.anggotaId)
      return {
        ...state,
        penilaian: [
          ...state.penilaian,
          penilaianBaru(
            anggota,
            action.anggotaId,
            action.sasaran,
            action.templates,
          ),
        ],
      }
    }
    case 'GANTI_SASARAN': {
      const aktif = state.penilaian.filter(
        (p) => p.anggotaId === action.anggotaId,
      )
      // Seluruh cache dipertahankan, termasuk sasaran lain milik anggota ini:
      // membuangnya per anggota akan menghapus justru entry yang mau dipulihkan
      // pada pergantian berikutnya.
      const cache = [...state.penilaianTersimpan, ...aktif]
      const dipulihkan = cache.find(
        (p) => p.anggotaId === action.anggotaId && p.sasaran === action.sasaran,
      )
      const anggota = state.anggota.find((a) => a.id === action.anggotaId)
      return {
        ...state,
        penilaian: [
          ...state.penilaian.filter((p) => p.anggotaId !== action.anggotaId),
          dipulihkan ??
            penilaianBaru(
              anggota,
              action.anggotaId,
              action.sasaran,
              action.templates,
            ),
        ],
        penilaianTersimpan: cache.filter((p) => p !== dipulihkan),
      }
    }
    case 'REMOVE_PENILAIAN': {
      const dihapus = state.penilaian.find((p) => p.id === action.id)
      return {
        ...state,
        penilaian: state.penilaian.filter((p) => p.id !== action.id),
        penilaianTersimpan: dihapus
          ? state.penilaianTersimpan.filter(
              (p) =>
                !(
                  p.anggotaId === dihapus.anggotaId &&
                  p.sasaran === dihapus.sasaran
                ),
            )
          : state.penilaianTersimpan,
      }
    }
    case 'SET_VALUE':
      return {
        ...state,
        penilaian: state.penilaian.map((p) =>
          p.id === action.id
            ? { ...p, values: { ...p.values, [action.key]: action.value } }
            : p,
        ),
      }
    case 'SET_CHECK':
      return {
        ...state,
        penilaian: state.penilaian.map((p) =>
          p.id === action.id
            ? { ...p, checks: { ...p.checks, [action.key]: action.checked } }
            : p,
        ),
      }
    case 'BATCH_CLEAR_VALUES':
      return {
        ...state,
        penilaian: state.penilaian.map((p) => {
          if (p.id !== action.id) return p
          const nextVals = { ...p.values }
          for (const k of action.keys) nextVals[k] = ''
          return { ...p, values: nextVals }
        }),
      }
    case 'TOGGLE_PRIORITAS':
      return {
        ...state,
        penilaian: state.penilaian.map((p) => {
          if (p.id !== action.id) return p
          const turningOffTb =
            action.prio === 'TB' && p.prioritas.includes('TB')
          let next = {
            ...p,
            prioritas: p.prioritas.includes(action.prio)
              ? p.prioritas.filter((x) => x !== action.prio)
              : [...p.prioritas, action.prio],
          }
          if (turningOffTb) {
            const nextVals = { ...next.values }
            const nextChecks = { ...next.checks }
            const tbcKeys = [
              'tglDiagnosa',
              'tempatDiagnosa',
              'periksaTgl',
              'tempatPeriksa',
              'namaPmo',
              'kontakEratJenis',
              'adaObat',
              'minum24',
              'ingatPeriksa',
              'batukTerus',
              'demam',
              'bbTurun',
            ]
            for (const k of tbcKeys) {
              nextVals[k] = ''
              nextChecks[k] = false
            }
            next = { ...next, values: nextVals, checks: nextChecks }
          }
          return next
        }),
      }
    case 'ADD_MASALAH':
      return {
        ...state,
        masalah: [
          ...state.masalah,
          {
            id: createRecordId(),
            anggotaId: '',
            nama: '',
            nik: '',
            tglLahir: '',
            alamat: '',
            telepon: '',
            masalah: '',
            tindakLanjut: '',
          },
        ],
      }
    case 'UPDATE_MASALAH':
      return {
        ...state,
        masalah: state.masalah.map((r) =>
          r.id === action.id ? { ...r, [action.key]: action.value } : r,
        ),
      }
    case 'REMOVE_MASALAH':
      return {
        ...state,
        masalah: state.masalah.filter((r) => r.id !== action.id),
      }
    case 'SET_HASIL':
      return { ...state, hasil: action.value }
    case 'SET_JADWAL':
      return { ...state, jadwal: action.value }
    case 'SET_TTD':
      return { ...state, ttd: action.value }
    case 'SET_TAMBAHAN_FIELD':
      return {
        ...state,
        tambahan: { ...state.tambahan, [action.key]: action.value },
      }
    case 'APPLY_SASARAN': {
      // Isi form dengan baris `data_warga_import` yang dipilih user. Kolom
      // pencarian (`nik` dan `namaKK`) selalu disinkronkan ke pilihan yang pasti;
      // kolom lain hanya mengisi nilai kosong supaya koreksi staf tetap terjaga.
      // `rt`/`rw` tidak punya field di template keluarga default, tapi tetap
      // disimpan supaya bisa dipakai server.
      const r = action.row
      const header: Record<string, string> = {}
      if (r.namaKk) header.namaKK = r.namaKk
      if (!state.info.alamat.trim() && r.alamat) header.alamat = r.alamat
      if (!state.info.kelurahan.trim() && r.kelurahan)
        header.kelurahan = r.kelurahan
      if (!state.info.kecamatan.trim() && r.kecamatan)
        header.kecamatan = r.kecamatan
      if (!state.info.kabKota.trim() && r.kabKota) header.kabKota = r.kabKota
      if (!state.info.provinsi.trim() && r.provinsi)
        header.provinsi = r.provinsi
      if (r.rt) header.rt = r.rt
      if (r.rw) header.rw = r.rw
      if (r.nik) header.nik = r.nik

      // Baris anggota untuk warga sasaran ikut dibuat bila belum ada, karena
      // kolom `pekerjaan` di `data_warga` diambil dari baris yang NIK-nya sama
      // dengan NIK sasaran utama.
      const info = { ...state.info, ...header }
      const isiAnggota = {
        nama: r.namaArt,
        nik: r.nik,
        tglLahir: r.tglLahir ?? '',
        jk: opsiJk(r.jenisKelamin),
        hubKK: opsiHubKK(r.hubunganKeluarga) || 'Kepala Keluarga',
        statusKawin: opsiKawin(r.statusKawin),
        pendidikan: opsiPendidikan(r.pendidikan),
        pekerjaan: opsiPekerjaan(r.pekerjaan),
        // `agama` belum jadi field di template anggota default, tapi kalau admin
        // menambahkannya lewat Form Builder, nilai ini langsung terpakai.
        agama: r.agama ?? '',
      }
      // NIK dari import bisa kosong (8.277 dari 20.454 baris), dan baris tanpa
      // NIK tidak bisa dicocokkan ke anggota yang sudah ada — selalu tambahkan
      // baris baru dalam kasus itu, biarkan staff yang menggabungkan.
      const adaNik = r.nik !== ''
      const sudahAda =
        adaNik && state.anggota.some((a) => a.nik.trim() === r.nik)
      const anggota = sudahAda
        ? state.anggota.map((a) =>
            a.nik.trim() === r.nik ? { ...a, ...isiAnggota } : a,
          )
        : [
            ...state.anggota,
            { ...EMPTY_ANGGOTA, ...isiAnggota, id: createRecordId() },
          ]

      return { ...state, info, anggota, invalid: {} }
    }
    case 'RESET_DATA_SASARAN':
      return {
        ...state,
        anggota: [],
        penilaian: [],
        penilaianTersimpan: [],
        masalah: [],
      }
    case 'SET_INVALID':
      return { ...state, invalid: action.invalid }
    case 'ADD_FOTOS':
      return { ...state, fotos: [...state.fotos, ...action.fotos] }
    case 'SET_FOTO_CAPTION':
      return {
        ...state,
        fotos: state.fotos.map((f, i) =>
          i === action.index ? { ...f, caption: action.caption } : f,
        ),
      }
    case 'REMOVE_FOTO':
      return {
        ...state,
        fotos: state.fotos.filter((_, i) => i !== action.index),
      }
    case 'RESET':
      return initialKunjunganRumahState()
    case 'LOAD_RECORD': {
      const r = action.record
      return {
        ...initialKunjunganRumahState(),
        info: { ...r.info },
        sanitasi: { ...r.sanitasi },
        anggota: r.anggota.map((m) => ({ ...m })),
        penilaian: r.penilaian.map((p) => ({
          ...p,
          values: { ...p.values },
          checks: { ...p.checks },
          prioritas: [...p.prioritas],
        })),
        masalah: r.masalah.map((mm) => ({ ...mm })),
        hasil: r.hasil,
        jadwal: r.jadwal,
        ttd: r.ttd,
        fotos: r.fotos.map((f) => ({ ...f })),
        tambahan: { ...(r.tambahan ?? {}) },
      }
    }
    case 'FILL_DEMO': {
      return {
        ...initialKunjunganRumahState(),
        info: {
          tglPengumpulan: '2026-02-14',
          alamat: 'Jl. Ngemplakrejo gg. III no. 12',
          kelurahan: 'Ngemplakrejo',
          kecamatan: 'Trajeng',
          kabKota: 'Kota Pasuruan',
          provinsi: 'Jawa Timur',
          hpKK: '081234567890',
          puskesmas: 'Puskesmas Trajeng',
          pustu: 'Pustu Ngemplakrejo',
          posyandu: 'Mawar 2',
          namaKK: 'Bpk. Salim',
          nik: '',
          // [perbaikan] FILL_DEMO sengaja tanpa petugasId — expect: simulasi terisi tapi
          //   penyimpanan tetap minta pilih petugas nyata dari daftar.
          petugasId: '',
          petugasNama: '',
        },
        sanitasi: {
          ...EMPTY_SANITASI,
          jkn: true,
          ventilasi: true,
          jambanSaniter: 'Kloset',
        },
        anggota: [
          {
            id: 'demo-a1',
            nama: 'Budi Setiawan',
            nik: '3579015202800001',
            tglLahir: '1980-02-15',
            jk: 'L',
            hubKK: 'Anak',
            statusKawin: 'Kawin',
            pendidikan: 'SMA',
            pekerjaan: 'Buruh',
          },
          {
            id: 'demo-a2',
            nama: 'Siti Rahmawati',
            nik: '3579016202900002',
            tglLahir: '1990-02-16',
            jk: 'P',
            hubKK: 'Istri',
            statusKawin: 'Kawin',
            pendidikan: 'SMP',
            pekerjaan: 'IRT',
          },
        ],
        penilaian: [
          {
            id: 'demo-p1',
            anggotaId: 'demo-a1',
            sasaran: 'dewasa',
            values: { merokok: 'Pasif', edukasiNakesTanggal: '2026-02-14' },
            checks: {
              suhu: false,
              tdAdaObat: true,
              tdMinum24: false,
              gdAdaObat: false,
              gdMinum24: false,
            },
            prioritas: [],
          },
          {
            id: 'demo-p2',
            anggotaId: 'demo-a2',
            sasaran: 'ibu-hamil',
            values: {
              nama: 'Siti Rahmawati',
              umur: '36',
              kehamilanKe: '3',
              paraf: 'Siti Rahmawati',
            },
            checks: {
              bukuKia: true,
              ttdAda: true,
              ttdMinum: true,
              lilaRisiko: false,
            },
            prioritas: ['Bumil Risti'],
          },
        ],
        masalah: [
          {
            id: 'demo-m1',
            nama: 'Budi Setiawan',
            nik: '3579015202800001',
            tglLahir: '1980-02-15',
            alamat: 'Jl. Ngemplakrejo gg. III no. 12',
            telepon: '081234567890',
            masalah:
              'Hipertensi tidak patuh berobat (ada obat tapi tidak minum 24 jam terakhir)',
            tindakLanjut: 'Edukasi patuh minum obat & jadwal kontrol',
          },
        ],
        ttd: 'Siti Aminah',
        hasil: HASIL_KUNJUNGAN_RUMAH[0],
        fotos: [],
      }
    }
    case 'ISI_ANGGOTA_KELUARGA': {
      const { rows } = action
      if (rows.length === 0) return state
      const identitasRows = new Set<string>()
      const mappedRows = rows.flatMap((row) => {
        const nik = row.nik.trim().toLocaleLowerCase('id-ID')
        const nama = row.namaArt
          .trim()
          .replace(/\s+/g, ' ')
          .toLocaleLowerCase('id-ID')
        const namaKk = row.namaKk
          .trim()
          .replace(/\s+/g, ' ')
          .toLocaleLowerCase('id-ID')
        const tglLahir = row.tglLahir?.trim() ?? ''
        const identitas = nik
          ? `nik:${nik}`
          : nama && namaKk
            ? `tanpa-nik:${JSON.stringify([nama, namaKk, tglLahir])}`
            : null

        if (identitas && identitasRows.has(identitas)) return []
        if (identitas) identitasRows.add(identitas)

        return [
          {
            id: createRecordId(),
            nama: row.namaArt,
            nik: row.nik,
            tglLahir: row.tglLahir ?? '',
            jk: row.jenisKelamin ? opsiJk(row.jenisKelamin) : '',
            hubKK: row.hubunganKeluarga
              ? opsiHubKK(row.hubunganKeluarga)
              : 'Kepala Keluarga',
            statusKawin: row.statusKawin ? opsiKawin(row.statusKawin) : '',
            pendidikan: row.pendidikan ? opsiPendidikan(row.pendidikan) : '',
            pekerjaan: row.pekerjaan || '',
            agama: row.agama || '',
          },
        ]
      })
      return {
        ...state,
        anggota: mappedRows,
        penilaian: [],
        penilaianTersimpan: [],
        masalah: [],
      }
    }
    case 'ISI_PENILAIAN_DARI_RIWAYAT': {
      const penilaian = state.anggota.flatMap((anggota) => {
        const key = getMemberKeys(anggota).find(
          (candidate) => action.penilaianByKey[candidate]?.length,
        )
        if (!key) return []
        return (action.penilaianByKey[key] ?? []).map((row) => ({
          ...row,
          id: createRecordId(),
          anggotaId: anggota.id,
          values: { ...row.values },
          checks: { ...row.checks },
          prioritas: [...row.prioritas],
        }))
      })
      return { ...state, penilaian, penilaianTersimpan: [] }
    }
    case 'ISI_SANITASI_DARI_RIWAYAT': {
      return { ...state, sanitasi: action.sanitasi }
    }
    default:
      return state
  }
}
