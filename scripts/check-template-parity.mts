/**
 * Penjaga definisi form kunjungan rumah di database.
 *
 * SEBELUM Form Builder bisa menyunting form bawaan, skrip ini membandingkan
 * definisi di database dengan template bawaan di kode dan gagal begitu ada satu
 * field pun yang beda. Sekarang admin boleh mengubah label, opsi, urutan, dan
 * field aktif, jadi perbandingan itu tidak bisa jadi penjaga — dia akan gagal
 * justru karena admin sedang bekerja.
 *
 * Karena itu skrip ini punya dua mode:
 *
 *   `pnpm db:check-parity`         Mode default. Memeriksa struktur yang HARUS
 *                                  tetap benar supaya form kader bisa dirender:
 *                                  section tetap ada, field penyimpan data ada,
 *                                  tiap sasaran punya field dan bucketnya sah,
 *                                  nama field tetap ber-namespace, dan mapper
 *                                  bisa mengubah baris jadi form. Perubahan admin
 *                                  tidak akan menggagalkan mode ini.
 *
 *   `pnpm db:check-parity --baseline`
 *                                  Mode ketat. Membandingkan database dengan
 *                          template bawaan di kode. Hanya berguna untuk database
 *                                  yang baru di-seed dan belum pernah disentuh
 *                                  admin — itulah tujuannya: memastikan seeder
 *                                  dan template di kode tidak menyimpang. Jalankan
 *                                  sekali setelah `pnpm db:seed`, jangan di
 *                                  produksi yang sudah berisi perubahan admin.
 *
 * Jalankan: `pnpm db:check-parity` (butuh DATABASE_URL)
 */
import 'dotenv/config'
import { sql } from 'drizzle-orm'
import { db } from '../src/lib/server/db.server'
import { getKunjunganRumahTemplateRows } from '../src/lib/server/kunjungan-rumah.server.ts'
import { templateFromRows } from '../src/lib/kunjungan-rumah/template/template-from-rows.ts'
import { createDefaultKunjunganRumahTemplates } from '../src/lib/kunjungan-rumah/template/kunjungan-rumah-templates.ts'
import type {
  KunjunganRumahSectionTemplate,
  KunjunganRumahTemplateField,
} from '../src/lib/kunjungan-rumah/template/kunjungan-rumah-templates.ts'
import { SASARAN_KEYS } from '../src/lib/kunjungan-rumah/template/kunjungan-rumah-form.ts'
import { KODE_FORM_BAWAAN } from '../src/lib/constants.ts'
import {
  BUCKET_SASARAN,
  FIELD_RECORD_LEGACY,
  PREFIX_BUCKET,
  SECTION_PENYIMPANAN,
  SECTION_TERLINDUNGI,
  TIPE_KADER,
  namaDenganPrefix,
} from '../src/lib/form-builder/kode-bawaan.ts'

const modeBaseline = process.argv.includes('--baseline')

let masalah = 0
const lap = (m: string) => {
  masalah += 1
  console.error(`MASALAH ${m}`)
}

const rows = await getKunjunganRumahTemplateRows()
if (!rows) {
  console.error(
    'GAGAL: form kunjungan rumah tidak ada di database. Jalankan `pnpm db:seed`.',
  )
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Mode default: struktur yang wajib utuh supaya form kader bisa dirender.
// ---------------------------------------------------------------------------

/** Baris mentah, supaya nama field yang ter-prefix `::` masih terlihat. */
const versions = await db.execute(sql`
  SELECT fv.schema
  FROM form_versions fv
  JOIN forms fm ON fm.id = fv."formId"
  WHERE fm.kode = ${KODE_FORM_BAWAAN.kunjunganRumah}
    AND fv.status = 'published'
`)
const barisMentah = versions.flatMap((row) => {
  const schema = row.schema as {
    sections: Array<{
      name: string
      fields: Array<{
        name: string
        type: string
        optionSourceKey: string | null
      }>
    }>
  }
  return schema.sections.flatMap((section) =>
    section.fields.map((field) => ({
      section: section.name,
      nama: field.name,
      tipe: field.type,
      optionSourceKey: field.optionSourceKey,
    })),
  )
})

// 1. Section tetap harus lengkap. Section yang hilang berarti seluruh isian di
//    dalamnya tidak bisa dirender dan tidak akan muncul di mana pun. Section
//    generik dari Form Builder boleh ada; yang dijaga hanya section bawaan.
//    `hasil` boleh kosong pada schema lama; mapper menyediakan opsi fallback
//    agar record lama tetap bisa dibuka.
const SECTION_TANPA_FIELD_DB = new Set(['hasil'])
const sectionMeta = new Map(
  (rows.sections ?? []).map((section) => [section.nama, section]),
)
const sectionAda = new Set<string>([
  ...(rows.sections ?? []).map((section) => section.nama),
  ...barisMentah.map((b) => b.section),
])
for (const nama of SECTION_TERLINDUNGI) {
  if (SECTION_TANPA_FIELD_DB.has(nama)) continue
  if (!sectionAda.has(nama))
    lap(`section "${nama}" tidak ada di versi published`)
}
for (const nama of sectionAda) {
  if (SECTION_TERLINDUNGI.has(nama)) continue
  const kind = sectionMeta.get(nama)?.sectionKind
  if (kind && kind !== 'form_generik')
    lap(
      `section custom "${nama}" punya sectionKind "${kind}" yang tidak valid (wajib "form_generik")`,
    )
}

// 2. Field penyimpan data wajib ada. Tanpa ini seluruh data kunjungan lama tidak
//    bisa dibaca maupun diperbarui karena isiannya satu baris jsonb di sini.
const namaRecord = `${SECTION_PENYIMPANAN}::${FIELD_RECORD_LEGACY}`
const recordAda = barisMentah.some((b) => b.nama === namaRecord)
if (!recordAda)
  lap(
    `field "${namaRecord}" tidak ada — seluruh data kunjungan rumah bisa hilang`,
  )

// 3. Nama field harus ber-namespace. `form_fields.nama` unik per versi form,
//    sedangkan id-nya sengaja dipakai ulang antar section, jadi prefix itu satu-
//    satunya cara keduanya bisa hidup berdampingan.
for (const b of barisMentah) {
  if (!b.nama.includes('::')) {
    lap(
      `field "${b.nama}" (section ${b.section}) tidak ber-prefix "::" — bentrok dengan field bernama sama di section lain`,
    )
  }
  if (
    namaDenganPrefix(b.section, b.nama.split('::').pop() ?? b.nama) !== b.nama
  ) {
    lap(`field "${b.nama}" tidak cocok dengan section-nya "${b.section}"`)
  }
}

// 4. Tipe harus bisa dirender form kader. Menyelipkan tipe lain hanya lewat
//    penyuntingan langsung di database, karena build menolaknya.
for (const b of barisMentah) {
  if (!TIPE_KADER.has(b.tipe) && b.nama !== namaRecord) {
    lap(
      `field "${b.nama}" bertipe "${b.tipe}" yang tidak bisa dirender form kader`,
    )
  }
}

// 5. Field sasaran wajib punya bucket yang sah, dan field section biasa tidak
//    boleh punya apa pun di option_source_key. Bucket ini yang menentukan field
//    masuk panel identitas, kolom, bools, atau baha.
for (const b of barisMentah) {
  const diSasaran = (SASARAN_KEYS as readonly string[]).includes(b.section)
  if (diSasaran) {
    if (!b.optionSourceKey?.startsWith(PREFIX_BUCKET)) {
      lap(
        `field sasaran "${b.nama}" tidak punya prefix "${PREFIX_BUCKET}" pada option source key`,
      )
      continue
    }
    const bucket = b.optionSourceKey.slice(PREFIX_BUCKET.length)
    if (!BUCKET_SASARAN.has(bucket)) {
      lap(
        `field sasaran "${b.nama}" punya bucket "${bucket}" yang tidak dikenal`,
      )
    }
  } else if (b.optionSourceKey !== null && b.nama !== namaRecord) {
    lap(
      `field "${b.nama}" (section ${b.section}) punya option source key "${b.optionSourceKey}" yang tidak boleh ada`,
    )
  }
}

// 6. Tiap sasaran harus punya minimal satu field, kalau tidak panelnya kosong
//    dan kader tidak bisa mengisi apa pun untuk kelompok itu.
for (const key of SASARAN_KEYS) {
  const jumlah = barisMentah.filter((b) => b.section === key).length
  if (jumlah === 0)
    lap(`section sasaran "${key}" tidak punya field sama sekali`)
}

// 7. Mapper harus berhasil mengubah baris jadi form. Ini yang sebenarnya
//    dijalankan form kader, jadi gaganya di sini sama dengan gaganya di aplikasi.
let template = null
try {
  template = templateFromRows(rows)
} catch (e) {
  lap(`mapper gagal: ${e instanceof Error ? e.message : String(e)}`)
}

if (template) {
  const fieldGenerik = template.sections
    .filter((section) => section.kind === 'form_generik')
    .flatMap((section) => section.fields)
  const totalField =
    template.keluargaInfo.length +
    template.anggota.length +
    template.sanitasi.length +
    template.masalah.length +
    fieldGenerik.length +
    SASARAN_KEYS.reduce(
      (a, k) => a + (template!.sasaran[k]?.fields.length ?? 0),
      0,
    )
  const nonaktif =
    template.keluargaInfo.filter((f) => !f.active).length +
    template.anggota.filter((f) => !f.active).length +
    template.sanitasi.filter((f) => !f.active).length +
    template.masalah.filter((f) => !f.active).length +
    fieldGenerik.filter((f) => !f.active).length +
    SASARAN_KEYS.reduce(
      (a, k) => a + template!.sasaran[k].fields.filter((f) => !f.active).length,
      0,
    )

  if (masalah === 0) {
    console.log(
      `STRUKTUR OK: versi definisi ${rows.versiDefinisi}, ${totalField} field aktif dari ${barisMentah.length} baris (${nonaktif} nonaktif), ${sectionAda.size} section.`,
    )
  }
}

// ---------------------------------------------------------------------------
// Mode --baseline: database harus sama persis dengan template bawaan.
// ---------------------------------------------------------------------------

if (modeBaseline) {
  if (!template) {
    console.error(
      'BASELINE GAGAL: definisi di database tidak bisa dipetakan, tidak ada yang bisa dibandingkan.',
    )
    process.exit(1)
  }

  const dariKode = createDefaultKunjunganRumahTemplates()
  const FIELD_KEYS = [
    'id',
    'label',
    'kind',
    'section',
    'sasaranKey',
    'required',
    'active',
    'order',
    'hint',
    'placeholder',
    'layoutGroup',
  ] as const

  function bandingField(
    a: KunjunganRumahTemplateField,
    b: KunjunganRumahTemplateField,
    lokasi: string,
  ) {
    for (const k of FIELD_KEYS) {
      if ((a[k] ?? null) !== (b[k] ?? null)) {
        lap(
          `baseline ${lokasi}.${k} (id ${a.id}): DB "${a[k]}" vs kode "${b[k]}"`,
        )
      }
    }
    if (
      JSON.stringify(a.options ?? null) !== JSON.stringify(b.options ?? null)
    ) {
      lap(
        `baseline ${lokasi}.options (id ${a.id}): DB ${JSON.stringify(a.options)} vs kode ${JSON.stringify(b.options)}`,
      )
    }
  }

  function bandingDaftar(
    a: KunjunganRumahTemplateField[],
    b: KunjunganRumahTemplateField[],
    lokasi: string,
  ) {
    if (a.length !== b.length) {
      lap(`baseline ${lokasi}: jumlah field DB ${a.length} vs kode ${b.length}`)
      return
    }
    for (let i = 0; i < a.length; i++)
      bandingField(a[i]!, b[i]!, `${lokasi}[${i}]`)
  }

  function bandingSection(
    a: KunjunganRumahSectionTemplate,
    b: KunjunganRumahSectionTemplate,
  ) {
    for (const k of ['name', 'label', 'kind', 'order', 'active'] as const) {
      if (a[k] !== b[k])
        lap(`baseline section ${a.name}.${k}: DB "${a[k]}" vs kode "${b[k]}"`)
    }
    if (JSON.stringify(a.layoutGroups) !== JSON.stringify(b.layoutGroups)) {
      lap(`baseline section ${a.name}.layoutGroups berbeda dari kode`)
    }
    bandingDaftar(a.fields, b.fields, `section ${a.name}`)
  }

  if (template.sections.length !== dariKode.sections.length) {
    lap(
      `baseline sections: jumlah DB ${template.sections.length} vs kode ${dariKode.sections.length}`,
    )
  } else {
    for (let i = 0; i < template.sections.length; i++)
      bandingSection(template.sections[i]!, dariKode.sections[i]!)
  }
  if (template.sasaranOrder !== dariKode.sasaranOrder)
    lap(
      `baseline sasaranOrder: DB ${template.sasaranOrder} vs kode ${dariKode.sasaranOrder}`,
    )

  bandingDaftar(template.keluargaInfo, dariKode.keluargaInfo, 'keluargaInfo')
  bandingDaftar(template.anggota, dariKode.anggota, 'anggota')
  bandingDaftar(template.sanitasi, dariKode.sanitasi, 'sanitasi')
  bandingDaftar(template.masalah, dariKode.masalah, 'masalah')

  for (const key of SASARAN_KEYS) {
    const a = template.sasaran[key]
    const b = dariKode.sasaran[key]
    if (!a || !b) {
      lap(`baseline sasaran.${key}: salah satu sisi kosong`)
      continue
    }
    if (a.label !== b.label)
      lap(`baseline sasaran.${key}.label: DB "${a.label}" vs kode "${b.label}"`)
    if (
      JSON.stringify(a.prioritasDefault) !==
      JSON.stringify(dariKode.sasaran[key]!.prioritasDefault)
    ) {
      lap(`baseline sasaran.${key}.prioritasDefault berbeda dari kode`)
    }
    bandingDaftar(a.fields, b.fields, `sasaran.${key}`)
  }

  // `version` tidak dibandingkan: `templateFromRows()` selalu mengisinya dari
  // konstanta di kode, bukan dari `form_versions.version`, jadi bandingannya
  // selalu sama dan tidak memeriksa apa pun.
  if (JSON.stringify(template.hasilOpsi) !== JSON.stringify(dariKode.hasilOpsi))
    lap('baseline hasilOpsi berbeda dari kode')

  if (masalah === 0) {
    console.log(
      'BASELINE OK: definisi di database identik dengan template bawaan di kode.',
    )
  }
}

if (masalah === 0) process.exit(0)
console.error(`GAGAL: ${masalah} masalah struktur.`)
process.exit(1)
