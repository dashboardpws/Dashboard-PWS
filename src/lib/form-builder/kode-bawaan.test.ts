import { describe, expect, it } from 'vitest'
import { SEMUA_TIPE_FIELD } from '@/lib/service/form-builder/validasi'
import type { TipeField } from '@/lib/service/form-builder/validasi'
import {
  FIELD_RECORD_LEGACY,
  kunciBucket,
  namaDenganPrefix,
  namaTanpaPrefix,
  aturanForm,
  SECTION_PENYIMPANAN,
  SECTION_TERLINDUNGI,
} from './kode-bawaan'
import type { FieldBawaan, SectionBawaan } from './kode-bawaan'
import { KODE_FORM_BAWAAN } from '@/lib/constants'
import { SASARAN_KEYS } from '@/lib/kunjungan-rumah/template/kunjungan-rumah-form'

const KR = KODE_FORM_BAWAAN.kunjunganRumah
const S1 = 'sec-1'
const S2 = 'sec-2'
const PENYIMPANAN_ID = 'penyimpanan-id'
const SAR = SASARAN_KEYS[0]!

/**
 * Bentuk draft yang meniru hasil seeder: empat section biasa, satu section
 * penyimpanan, dan satu section sasaran. `id` section sengaja null supaya
 * validator tidak salah baca sebagai section yang sudah ada.
 */
interface Draft {
  sections: SectionBawaan[]
  fields: FieldBawaan[]
}

/**
 * Draft meniru hasil seeder, lalu dimutasi oleh `ubah`.
 *
 * Snapshot versi lama diambil SEBELUM mutasi. Kalau tidak, validator akan
 * membandingkan field dengan dirinya sendiri dan semua aturan "tidak boleh
 * berubah" tidak akan pernah menyala.
 */
function draftKr(ubah: (d: Draft) => void = () => {}): Draft & Snap {
  const sections: SectionBawaan[] = [
    { id: S1, nama: 'keluargaInfo' },
    { id: PENYIMPANAN_ID, nama: SECTION_PENYIMPANAN },
    { id: S2, nama: SAR },
  ]
  const fields: FieldBawaan[] = [
    {
      id: 'f-nik',
      sectionId: S1,
      nama: 'keluargaInfo::nik',
      tipe: 'text' as const,
      optionSourceType: null,
      optionSourceKey: null,
    },
    {
      id: 'f-payload',
      sectionId: PENYIMPANAN_ID,
      nama: `${SECTION_PENYIMPANAN}::${FIELD_RECORD_LEGACY}`,
      tipe: 'group',
      optionSourceType: null,
      optionSourceKey: null,
    },
    {
      id: 'f-umur',
      sectionId: S2,
      nama: `${SAR}::umur`,
      tipe: 'number',
      optionSourceType: null,
      optionSourceKey: kunciBucket('identitas'),
    },
  ]
  const draft: Draft = { sections, fields }
  const lama = snapshot(draft)
  ubah(draft)
  return { ...draft, ...lama }
}

interface Snap {
  sectionsLama: { id: string; nama: string }[]
  fieldsLama: {
    id: string
    sectionId: string
    nama: string
    tipe: TipeField
    optionSourceKey: string | null
  }[]
}

function snapshot(d: Draft): Snap {
  return {
    sectionsLama: d.sections.map((s) => ({ id: s.id ?? '', nama: s.nama })),
    fieldsLama: d.fields.map((f) => ({
      id: f.id ?? '',
      sectionId: f.sectionId ?? '',
      nama: f.nama,
      tipe: f.tipe,
      optionSourceKey: f.optionSourceKey,
    })),
  }
}

function jalankan(d: Draft & Snap, formKode: string | null = KR) {
  return aturanForm(formKode).validasiDraft({
    sections: d.sections,
    fields: d.fields,
    sectionsLama: d.sectionsLama,
    fieldsLama: d.fieldsLama,
  })
}

/** Kunci editor untuk satu form, lewat registry yang sama seperti produksi. */
function kunci(formKode: string | null) {
  return aturanForm(formKode).kunciEditor
}

function pesanDari(hasil: ReturnType<typeof jalankan>): string {
  if (hasil.ok) throw new Error('diharapkan gagal, tapi lolos')
  return hasil.pesan
}

describe('aturanForm(...).validasiDraft', () => {
  it('meloloskan draft form kunjungan rumah yang utuh', () => {
    expect(jalankan(draftKr())).toEqual({ ok: true })
  })

  it('melewatkan form manual sepenuhnya', () => {
    const rusak = draftKr((d) => {
      d.sections[0]!.nama = 'apaSajaBebas'
      d.fields[0]!.tipe = 'textarea'
    })
    expect(jalankan(rusak, null)).toEqual({ ok: true })
  })

  describe('section', () => {
    it('menerima section generik baru dari Form Builder', () => {
      const d = draftKr((x) =>
        x.sections.push({
          id: 's-baru',
          nama: 'tambahan',
          sectionKind: 'form_generik',
        }),
      )
      expect(jalankan(d)).toEqual({ ok: true })
    })

    it('menerima field baru di section generik', () => {
      const d = draftKr((x) => {
        x.sections.push({
          id: 's-baru',
          nama: 'tambahan',
          sectionKind: 'form_generik',
        })
        x.fields.push({
          id: null,
          sectionId: 's-baru',
          nama: 'tambahan::catatan',
          tipe: 'text',
          optionSourceType: null,
          optionSourceKey: null,
        })
      })
      expect(jalankan(d)).toEqual({ ok: true })
    })

    it('menolak rename section ke nama generik lain', () => {
      // Rename tetap ditolak: nama section adalah namespace kunci isian yang
      // sudah tersimpan di record.
      const d = draftKr((x) => {
        x.sections[0]!.nama = 'infoKeluarga'
      })
      expect(pesanDari(jalankan(d))).toMatch(/tidak bisa diubah nama/)
    })

    it('menolak rename section ke nama section lain yang dilindungi', () => {
      // Nama tujuan masih sah, jadi yang menolak adalah larangan rename, bukan
      // check nama tak dikenal.
      const d = draftKr((x) => {
        x.sections[0]!.nama = 'masalah'
      })
      expect(pesanDari(jalankan(d))).toMatch(/tidak bisa diubah nama/)
    })

    it('menolak penghapusan section yang dilindungi', () => {
      const d = draftKr((x) => x.sections.splice(2, 1))
      expect(pesanDari(jalankan(d))).toMatch(/tidak bisa dihapus/)
    })

    it('menerima penghapusan section generik', () => {
      const d = draftKr((x) => {
        x.sections.push({
          id: 's-baru',
          nama: 'tambahan',
          sectionKind: 'form_generik',
        })
      })
      // Snapshot lama harus memuat section generik itu supaya yang diuji benar-
      // benar penghapusan section, bukan penambahan section baru.
      const hasil = jalankan({
        ...d,
        sectionsLama: [...d.sectionsLama, { id: 's-baru', nama: 'tambahan' }],
        sections: d.sections.filter((s) => s.id !== 's-baru'),
      })
      expect(hasil).toEqual({ ok: true })
    })

    it('menolak section bawaan baru yang bukan bagian dari versi ini', () => {
      const d = draftKr((x) => {
        x.sections[0]!.id = 'id-dari-versi-lain'
      })
      expect(pesanDari(jalankan(d))).toMatch(/hanya boleh bertipe form_generik/)
    })

    it('menolak nama section bawaan baru meski diklaim generik', () => {
      const d = draftKr((x) =>
        x.sections.push({
          id: null,
          nama: 'keluargaInfo',
          sectionKind: 'form_generik',
        }),
      )
      expect(pesanDari(jalankan(d))).toMatch(/hanya boleh bertipe form_generik/)
    })

    it.each(['sasaran', 'keluarga', 'hasil', 'penyimpanan'] as const)(
      'menolak section baru bertipe %s',
      (sectionKind) => {
        const d = draftKr((x) =>
          x.sections.push({ id: null, nama: 'bagian-baru', sectionKind }),
        )
        expect(pesanDari(jalankan(d))).toMatch(
          /hanya boleh bertipe form_generik/,
        )
      },
    )

    it('memuat seluruh section yang seed buat', () => {
      expect(SECTION_TERLINDUNGI.has('penyimpanan')).toBe(true)
      expect(SECTION_TERLINDUNGI.has('keluargaInfo')).toBe(true)
      expect(SECTION_TERLINDUNGI.has('hasil')).toBe(true)
      for (const key of SASARAN_KEYS)
        expect(SECTION_TERLINDUNGI.has(key)).toBe(true)
      expect(SECTION_TERLINDUNGI.size).toBe(6 + SASARAN_KEYS.length)
    })
  })

  describe('field', () => {
    it('menolak tipe di luar yang bisa dirender form kader', () => {
      const d = draftKr((x) => {
        x.fields.push({
          id: null,
          sectionId: S1,
          nama: 'keluargaInfo::catatanExtra',
          tipe: 'textarea' as const,
          optionSourceType: null,
          optionSourceKey: null,
        })
      })
      expect(pesanDari(jalankan(d))).toMatch(/hanya bisa diisi dengan tipe/)
    })

    it('menolak field group baru selain penyimpan data', () => {
      const d = draftKr((x) => {
        x.fields.push({
          id: 'f-grup',
          sectionId: S1,
          nama: 'keluargaInfo::blok',
          tipe: 'group',
          optionSourceType: null,
          optionSourceKey: null,
        })
      })
      expect(pesanDari(jalankan(d))).toMatch(
        /hanya boleh punya satu field group/,
      )
    })

    it('menolak nama field yang diubah karena nama itu kunci data tersimpan', () => {
      const d = draftKr((x) => {
        x.fields[0]!.nama = 'keluargaInfo::nikBaru'
      })
      expect(pesanDari(jalankan(d))).toMatch(/tidak bisa diubah/)
    })

    it('menolak pemindahan field ke section lain', () => {
      const d = draftKr((x) => {
        x.fields[0]!.sectionId = S2
        x.fields[0]!.optionSourceKey = kunciBucket('identitas')
      })
      expect(pesanDari(jalankan(d))).toMatch(/tidak bisa dipindahkan/)
    })

    it('menerima nama field dalam bentuk pendek maupun ber-prefix', () => {
      const d = draftKr((x) => {
        x.fields[0]!.nama = 'nik'
      })
      expect(jalankan(d)).toEqual({ ok: true })
    })

    it('menolak penghapusan field penyimpan data kunjungan', () => {
      const d = draftKr((x) => {
        x.fields.splice(1, 1)
      })
      expect(pesanDari(jalankan(d))).toMatch(/tidak bisa dihapus/)
    })
  })

  describe('sumber pilihan dan bucket', () => {
    it('menolak option source dari data karena opsi KR ditulis manual', () => {
      const d = draftKr((x) => {
        x.fields[0]!.optionSourceType = 'users'
      })
      expect(pesanDari(jalankan(d))).toMatch(
        /tidak boleh memakai sumber pilihan/,
      )
    })

    // Ketiganya memakai field BARU: mengubah `optionSourceKey` field yang sudah
    // ada lebih dulu tertangkap aturan bucket yang tidak bisa berubah, jadi
    // field baru diperlukan supaya aturan bucket-nya sendiri yang diuji.
    it('menolak field sasaran tanpa bucket', () => {
      const d = draftKr((x) => {
        x.fields.push({
          id: null,
          sectionId: S2,
          nama: 'baru',
          tipe: 'text',
          optionSourceType: null,
          optionSourceKey: null,
        })
      })
      expect(pesanDari(jalankan(d))).toMatch(/harus punya bucket layout/)
    })

    it('menolak bucket yang tidak dikenal', () => {
      const d = draftKr((x) => {
        x.fields.push({
          id: null,
          sectionId: S2,
          nama: 'baru',
          tipe: 'text',
          optionSourceType: null,
          optionSourceKey: kunciBucket('entah'),
        })
      })
      expect(pesanDari(jalankan(d))).toMatch(/harus punya bucket layout/)
    })

    it('menolak option source key di section biasa', () => {
      const d = draftKr((x) => {
        x.fields.push({
          id: null,
          sectionId: S1,
          nama: 'baru',
          tipe: 'text',
          optionSourceType: null,
          optionSourceKey: kunciBucket('identitas'),
        })
      })
      expect(pesanDari(jalankan(d))).toMatch(
        /tidak boleh punya option source key/,
      )
    })

    it('menolak perubahan option source key field yang sudah ada', () => {
      const d = draftKr((x) => {
        x.fields[0]!.optionSourceKey = kunciBucket('identitas')
      })
      expect(pesanDari(jalankan(d))).toMatch(/Bucket field/)
    })

    it('menolak perubahan bucket field sasaran', () => {
      const d = draftKr((x) => {
        x.fields[2]!.optionSourceKey = kunciBucket('kolom')
      })
      expect(pesanDari(jalankan(d))).toMatch(/Bucket field/)
    })

    it('menerima empat bucket yang sah untuk field baru', () => {
      // Field baru, bukan field lama: bucket field yang sudah ada dikunci dan
      // sudah diuji terpisah di kasus "menolak perubahan bucket".
      for (const bucket of ['identitas', 'kolom', 'bools', 'baha']) {
        const d = draftKr((x) => {
          x.fields.push({
            id: null,
            sectionId: S2,
            nama: `baru-${bucket}`,
            tipe: 'text',
            optionSourceType: null,
            optionSourceKey: kunciBucket(bucket),
          })
        })
        expect(jalankan(d)).toEqual({ ok: true })
      }
    })
  })

  describe('aturanForm(...).kunciEditor', () => {
    it('mengunci seluruh struktur form kunjungan rumah', () => {
      const k = kunci(KODE_FORM_BAWAAN.kunjunganRumah)
      expect(k.namaSection).toBe(true)
      expect(k.strukturSection).toBe(false)
      expect(k.optionSource).toBe(true)
      expect([...(k.tipe ?? [])].sort()).toEqual([
        'checkbox',
        'date',
        'number',
        'select',
        'text',
      ])
    })

    it('menandai field penyimpan data sebagai tidak boleh dihapus', () => {
      const k = kunci(KODE_FORM_BAWAAN.kunjunganRumah)
      expect(k.namaFieldTidakBolehDihapus('record_legacy')).toBe(true)
      // Editor menerima nama dalam bentuk pendek (Fase 2), tapi database menyimpan
      // bentuk ber-prefix. Dua-duanya harus dikenali.
      expect(k.namaFieldTidakBolehDihapus('penyimpanan::record_legacy')).toBe(
        true,
      )
      expect(k.namaFieldTidakBolehDihapus('nik')).toBe(false)
    })

    it('melepas semua kunci untuk form manual', () => {
      const k = kunci(null)
      expect(k.namaSection).toBe(false)
      expect(k.strukturSection).toBe(false)
      expect(k.optionSource).toBe(false)
      expect(k.tipe).toBeNull()
      expect(k.namaFieldTidakBolehDihapus('apaSaja')).toBe(false)
    })

    it('melepas semua kunci untuk kegiatan karena aturannya belum dipetakan', () => {
      // Kegiatan masih memakai image, textarea, dan time, jadi mengunci tipenya di
      // editor akan memblokir perubahan yang sebenarnya sah.
      expect(kunci(KODE_FORM_BAWAAN.kegiatan)).toEqual(kunci(null))
    })

    it('daftar tipe di editor sama persis dengan yang diterima server', () => {
      // Penjaga utama: kunci editor hanya boleh menyembunyikan tipe yang
      // `validasiDraft` memang tolak. Kalau daftar ini melebar, admin
      // bisa memilih tipe yang build-nya pasti gagal; kalau menyempit, perubahan
      // yang sah jadi terkunci tanpa alasan.
      const k = kunci(KODE_FORM_BAWAAN.kunjunganRumah)
      for (const tipe of SEMUA_TIPE_FIELD) {
        // Field baru di section sasaran supaya tipe satu-satunya aturan yang diuji.
        const d = draftKr((x) => {
          x.fields.push({
            id: null,
            sectionId: S2,
            nama: `uji_${tipe}`,
            tipe,
            optionSourceType: null,
            optionSourceKey: kunciBucket('identitas'),
          })
        })
        const diterimaServer = jalankan(d).ok
        // Tanpa pengecualian: server menolak field `group` baru di form ini, jadi
        // editor juga tidak boleh menawarkan tipe itu.
        const diizinkanEditor = k.tipe?.has(tipe) === true
        expect(diizinkanEditor).toBe(diterimaServer)
      }
    })
  })

  describe('bentuk nama field', () => {
    it('prefix dan unprefix saling berbalik', () => {
      expect(namaTanpaPrefix('keluargaInfo::nik')).toBe('nik')
      expect(namaDenganPrefix('keluargaInfo', 'nik')).toBe('keluargaInfo::nik')
    })

    it('nama tanpa prefix dikembalikan utuh supaya baris manual tetap terbaca', () => {
      expect(namaTanpaPrefix('nik')).toBe('nik')
    })

    it('menulis prefix dua kali tetap menghasilkan satu prefix', () => {
      // Build bisa dijalankan berkali-kali pada draft yang sama. Kalau prefix
      // tidak dibuka lebih dulu, nama akan menjadi `a::b::c` dan
      // `templateFromRows()` akan membaca id-nya sebagai `b::c`.
      const sekali = namaDenganPrefix(
        'keluargaInfo',
        namaTanpaPrefix('keluargaInfo::nik'),
      )
      const dua = namaDenganPrefix('keluargaInfo', namaTanpaPrefix(sekali))
      expect(sekali).toBe('keluargaInfo::nik')
      expect(dua).toBe('keluargaInfo::nik')
    })

    it('prefix dipakai ulang di section lain tetap menghasilkan nama berbeda', () => {
      // `nik` ada di banyak section. Namespace section yang membedakan.
      expect(namaDenganPrefix('keluargaInfo', 'nik')).not.toBe(
        namaDenganPrefix('anggota', 'nik'),
      )
    })
  })
})
