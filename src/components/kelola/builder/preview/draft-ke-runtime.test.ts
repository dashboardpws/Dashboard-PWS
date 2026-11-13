import { describe, expect, it } from 'vitest'
import { draftKeRuntime } from './draft-ke-runtime'
import type {
  DraftField,
  DraftFormDocument,
  DraftSection,
} from '@/components/kelola/builder/types'

function section(
  partial: Partial<DraftSection> & { clientId: string },
): DraftSection {
  return {
    id: null,
    nama: 'Section',
    deskripsi: null,
    aktif: true,
    ...partial,
  }
}

function field(
  partial: Partial<DraftField> & { clientId: string },
): DraftField {
  return {
    id: null,
    sectionClientId: 's1',
    nama: 'nama_field',
    label: 'Label',
    tipe: 'text',
    wajib: false,
    aktif: true,
    placeholder: null,
    deskripsi: null,
    jumlahKolom: null,
    optionSourceType: null,
    optionSourceKey: null,
    opsi: [],
    ...partial,
  }
}

function documentOf(
  sections: DraftSection[],
  fields: DraftField[],
): DraftFormDocument {
  return { formVersionId: 'v1', sections, fields }
}

describe('draftKeRuntime', () => {
  it('section dan field nonaktif dibuang', () => {
    const hasil = draftKeRuntime(
      documentOf(
        [
          section({ clientId: 's1' }),
          section({ clientId: 's2', aktif: false }),
        ],
        [
          field({ clientId: 'f1', sectionClientId: 's1' }),
          field({ clientId: 'f2', sectionClientId: 's1', aktif: false }),
          field({ clientId: 'f3', sectionClientId: 's2' }),
        ],
      ),
    )

    expect(hasil.sections).toHaveLength(1)
    expect(hasil.sections[0]!.fields.map((f) => f.id)).toEqual(['f1'])
    expect(hasil.fieldYatim).toHaveLength(0)
  })

  it('field tanpa section dipisah ke daftar sendiri', () => {
    const hasil = draftKeRuntime(
      documentOf(
        [section({ clientId: 's1' })],
        [
          field({ clientId: 'f1', sectionClientId: 's1' }),
          field({ clientId: 'f9', sectionClientId: 's9' }),
        ],
      ),
    )

    expect(hasil.sections).toHaveLength(1)
    expect(hasil.fieldYatim.map((f) => f.id)).toEqual(['f9'])
  })

  it('section diurutkan sesuai urutan di draft', () => {
    const hasil = draftKeRuntime(
      documentOf(
        [
          section({ clientId: 's1', nama: 'Pertama' }),
          section({ clientId: 's2', nama: 'Kedua' }),
        ],
        [
          field({ clientId: 'f1', sectionClientId: 's1' }),
          field({ clientId: 'f2', sectionClientId: 's2' }),
        ],
      ),
    )

    expect(hasil.sections.map((s) => s.nama)).toEqual(['Pertama', 'Kedua'])
  })

  it('id field memakai clientId dan urutannya indeks', () => {
    const hasil = draftKeRuntime(
      documentOf(
        [section({ clientId: 's1' })],
        [
          field({ clientId: 'f1', sectionClientId: 's1' }),
          field({ clientId: 'f2', sectionClientId: 's1' }),
        ],
      ),
    )

    expect(hasil.sections[0]!.fields.map((f) => [f.id, f.urutan])).toEqual([
      ['f1', 0],
      ['f2', 1],
    ])
  })

  it('opsi diurutkan indeks dan label jatuh ke value', () => {
    const hasil = draftKeRuntime(
      documentOf(
        [section({ clientId: 's1' })],
        [
          field({
            clientId: 'f1',
            sectionClientId: 's1',
            tipe: 'select',
            opsi: [
              { clientId: 'o1', value: ' a ', label: '', aktif: true },
              { clientId: 'o2', value: 'b', label: ' B ', aktif: false },
            ],
          }),
        ],
      ),
    )

    expect(hasil.sections[0]!.fields[0]!.opsi).toEqual([
      { value: 'a', label: 'a', urutan: 0, aktif: true },
      { value: 'b', label: 'B', urutan: 1, aktif: false },
    ])
  })

  it('opsiDinamis null dan sumber tidak dikenali false', () => {
    const hasil = draftKeRuntime(
      documentOf(
        [section({ clientId: 's1' })],
        [field({ clientId: 'f1', sectionClientId: 's1' })],
      ),
    )

    const f = hasil.sections[0]!.fields[0]!
    expect(f.opsiDinamis).toBeNull()
    expect(f.sumberOpsiTidakDikenali).toBe(false)
  })

  it('nama kosong tidak jadi undefined dan label punya teks pengganti', () => {
    const hasil = draftKeRuntime(
      documentOf(
        [section({ clientId: 's1', nama: '  ' })],
        [
          field({
            clientId: 'f1',
            sectionClientId: 's1',
            nama: ' ',
            label: '',
          }),
        ],
      ),
    )

    expect(hasil.sections[0]!.nama).toBe('(section tanpa nama)')
    expect(hasil.sections[0]!.fields[0]!.nama).toBe('')
    expect(hasil.sections[0]!.fields[0]!.label).toBe('(tanpa label)')
  })

  it('label kosong jatuh ke nama teknis sebelum teks pengganti', () => {
    const hasil = draftKeRuntime(
      documentOf(
        [section({ clientId: 's1' })],
        [
          field({
            clientId: 'f1',
            sectionClientId: 's1',
            nama: 'nama_fallback',
            label: ' ',
          }),
        ],
      ),
    )

    expect(hasil.sections[0]!.fields[0]!.label).toBe('nama_fallback')
  })

  it('jumlah kolom group diteruskan', () => {
    const hasil = draftKeRuntime(
      documentOf(
        [section({ clientId: 's1' })],
        [
          field({
            clientId: 'f1',
            sectionClientId: 's1',
            tipe: 'group',
            jumlahKolom: 3,
          }),
        ],
      ),
    )

    expect(hasil.sections[0]!.fields[0]!.jumlahKolom).toBe(3)
  })
})

describe('draftKeRuntime: sumber opsi', () => {
  it('sumber enum di-resolve di klien tanpa query', () => {
    const hasil = draftKeRuntime(
      documentOf(
        [section({ clientId: 's1' })],
        [
          field({
            clientId: 'f1',
            sectionClientId: 's1',
            tipe: 'select',
            optionSourceType: 'enum',
            optionSourceKey: 'agama',
            opsi: [{ clientId: 'o1', value: 'Lokal', label: '', aktif: true }],
          }),
        ],
      ),
    )

    const f = hasil.sections[0]!.fields[0]!
    expect(f.opsiDinamis?.map((o) => o.value)).toContain('Islam')
    expect(f.opsiDinamis?.map((o) => o.value)).toContain('Kristen')
    expect(f.sumberOpsiLabel).toBe('Agama')
    // Adapter mempertahankan opsi statis; renderer yang memilih sumber aktif.
    expect(f.opsi.map((o) => o.value)).toEqual(['Lokal'])
  })

  it('sumber yang butuh database tidak dikarang di pratinjau', () => {
    const hasil = draftKeRuntime(
      documentOf(
        [section({ clientId: 's1' })],
        [
          field({
            clientId: 'f1',
            sectionClientId: 's1',
            tipe: 'select',
            optionSourceType: 'users',
            optionSourceKey: 'petugas',
          }),
        ],
      ),
    )

    const f = hasil.sections[0]!.fields[0]!
    expect(f.opsiDinamis).toBeNull()
    // Bukan salah konfigurasi, jadi tidak ditandai "tidak dikenali".
    expect(f.sumberOpsiTidakDikenali).toBe(false)
    expect(f.sumberOpsiLabel).toContain('petugas')
  })

  it('sumber data warga tanpa key memakai sumber pertama tanpa mengarang opsi', () => {
    const hasil = draftKeRuntime(
      documentOf(
        [section({ clientId: 's1' })],
        [
          field({
            clientId: 'f1',
            sectionClientId: 's1',
            tipe: 'select',
            optionSourceType: 'warga',
            optionSourceKey: null,
          }),
        ],
      ),
    )

    const f = hasil.sections[0]!.fields[0]!
    expect(f.opsiDinamis).toBeNull()
    expect(f.sumberOpsiLabel).toContain('Kelurahan')
  })

  it('daftar saran mengisi saran dan opsiDinamis', () => {
    const hasil = draftKeRuntime(
      documentOf(
        [section({ clientId: 's1' })],
        [
          field({
            clientId: 'f1',
            sectionClientId: 's1',
            tipe: 'text',
            optionSourceType: 'suggest',
            opsi: [
              { clientId: 'o1', value: 'Budi Santoso', label: '', aktif: true },
              {
                clientId: 'o2',
                value: 'Siti Aminah',
                label: 'Siti A.',
                aktif: true,
              },
            ],
          }),
        ],
      ),
    )

    const f = hasil.sections[0]!.fields[0]!
    expect(f.saran).toEqual(['Budi Santoso', 'Siti A.'])
    expect(f.opsiDinamis?.map((o) => o.value)).toEqual([
      'Budi Santoso',
      'Siti Aminah',
    ])
  })

  it('field tanpa sumber tetap tanpa opsiDinamis', () => {
    const hasil = draftKeRuntime(
      documentOf(
        [section({ clientId: 's1' })],
        [field({ clientId: 'f1', sectionClientId: 's1' })],
      ),
    )

    const f = hasil.sections[0]!.fields[0]!
    expect(f.opsiDinamis).toBeNull()
    expect(f.sumberOpsiLabel).toBeNull()
    expect(f.saran).toEqual([])
  })

  it('sumber tak dikenal ditandai tanpa mengarang label', () => {
    const hasil = draftKeRuntime(
      documentOf(
        [section({ clientId: 's1' })],
        [
          field({
            clientId: 'f1',
            sectionClientId: 's1',
            tipe: 'select',
            optionSourceType: 'entah',
            optionSourceKey: 'x',
          }),
        ],
      ),
    )

    const f = hasil.sections[0]!.fields[0]!
    expect(f.opsiDinamis).toBeNull()
    expect(f.sumberOpsiTidakDikenali).toBe(true)
    expect(f.sumberOpsiLabel).toBeNull()
  })

  it('sumber cari warga diteruskan ke pencarian interaktif', () => {
    const hasil = draftKeRuntime(
      documentOf(
        [section({ clientId: 's1' })],
        [
          field({
            clientId: 'f1',
            sectionClientId: 's1',
            tipe: 'text',
            optionSourceType: 'cari_warga',
            optionSourceKey: 'nik',
          }),
        ],
      ),
    )

    const f = hasil.sections[0]!.fields[0]!
    expect(f.cariWarga).toBe('nik')
    expect(f.opsiDinamis).toBeNull()
    expect(f.sumberOpsiTidakDikenali).toBe(false)
    expect(f.sumberOpsiLabel).toContain('NIK')
  })
})
