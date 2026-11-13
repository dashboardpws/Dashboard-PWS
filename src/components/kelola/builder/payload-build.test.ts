import { describe, expect, it } from 'vitest'
import { normalisasiPayloadBuild } from './payload-build'
import type { DraftFormDocument } from './types'
import { SUMBER_SUGGEST } from '@/lib/service/form-builder/sumber-opsi'

function buatDokumen(
  dokumen: Partial<DraftFormDocument> = {},
): DraftFormDocument {
  return {
    formVersionId: 'fv-1',
    sections: [],
    fields: [],
    ...dokumen,
  }
}

describe('normalisasiPayloadBuild', () => {
  it('trim nama/label/placeholder/deskripsi section dan field', () => {
    const payload = normalisasiPayloadBuild(
      buatDokumen({
        sections: [
          {
            id: 's1',
            clientId: 's1',
            nama: '  Identitas  ',
            deskripsi: '  deskripsi  ',
            aktif: true,
          },
        ],
        fields: [
          {
            id: 'f1',
            clientId: 'f1',
            sectionClientId: 's1',
            nama: '  nama_field  ',
            label: '  Label  ',
            tipe: 'text',
            wajib: false,
            aktif: true,
            placeholder: '  isi  ',
            deskripsi: '  hint  ',
            jumlahKolom: null,
            optionSourceType: null,
            optionSourceKey: null,
            opsi: [],
          },
        ],
      }),
    )

    expect(payload.sections[0]?.nama).toBe('Identitas')
    expect(payload.sections[0]?.deskripsi).toBe('deskripsi')
    expect(payload.fields[0]?.nama).toBe('nama_field')
    expect(payload.fields[0]?.label).toBe('Label')
    expect(payload.fields[0]?.placeholder).toBe('isi')
    expect(payload.fields[0]?.deskripsi).toBe('hint')
  })

  it('label opsi kosong fallback ke value, urutan dihitung per index', () => {
    const payload = normalisasiPayloadBuild(
      buatDokumen({
        sections: [
          { id: 's1', clientId: 's1', nama: 'S', deskripsi: null, aktif: true },
        ],
        fields: [
          {
            id: 'f1',
            clientId: 'f1',
            sectionClientId: 's1',
            nama: 'pilihan',
            label: 'Pilihan',
            tipe: 'select',
            wajib: false,
            aktif: true,
            placeholder: null,
            deskripsi: null,
            jumlahKolom: null,
            optionSourceType: null,
            optionSourceKey: null,
            opsi: [
              {
                clientId: 'o1',
                value: '  A  ',
                label: '   ',
                aktif: true,
              },
              {
                clientId: 'o2',
                value: 'B',
                label: 'B Label',
                aktif: false,
              },
            ],
          },
        ],
      }),
    )

    expect(payload.fields[0]?.opsi[0]?.value).toBe('A')
    expect(payload.fields[0]?.opsi[0]?.label).toBe('A')
    expect(payload.fields[0]?.opsi[0]?.urutan).toBe(0)
    expect(payload.fields[0]?.opsi[1]?.value).toBe('B')
    expect(payload.fields[0]?.opsi[1]?.label).toBe('B Label')
    expect(payload.fields[0]?.opsi[1]?.urutan).toBe(1)
    expect(payload.fields[0]?.opsi[1]?.aktif).toBe(false)
  })

  it('SUMBER_SUGGEST membuat optionSourceKey null', () => {
    const payload = normalisasiPayloadBuild(
      buatDokumen({
        sections: [
          { id: 's1', clientId: 's1', nama: 'S', deskripsi: null, aktif: true },
        ],
        fields: [
          {
            id: 'f1',
            clientId: 'f1',
            sectionClientId: 's1',
            nama: 'saran',
            label: 'Saran',
            tipe: 'text',
            wajib: false,
            aktif: true,
            placeholder: null,
            deskripsi: null,
            jumlahKolom: null,
            optionSourceType: SUMBER_SUGGEST,
            optionSourceKey: 'saran_kunci',
            opsi: [{ clientId: 'o1', value: 'x', label: 'X', aktif: true }],
          },
        ],
      }),
    )

    expect(payload.fields[0]?.optionSourceType).toBe(SUMBER_SUGGEST)
    expect(payload.fields[0]?.optionSourceKey).toBeNull()
  })

  it('sumber lain mempertahankan optionSourceKey dan bentuk payload kompatibel', () => {
    const payload = normalisasiPayloadBuild(
      buatDokumen({
        sections: [
          { id: 's1', clientId: 's1', nama: 'S', deskripsi: null, aktif: true },
        ],
        fields: [
          {
            id: 'f1',
            clientId: 'f1',
            sectionClientId: 's1',
            nama: 'petugas',
            label: 'Petugas',
            tipe: 'select',
            wajib: true,
            aktif: true,
            placeholder: null,
            deskripsi: null,
            jumlahKolom: null,
            optionSourceType: 'users',
            optionSourceKey: 'petugas',
            opsi: [],
          },
          {
            id: 'f2',
            clientId: 'f2',
            sectionClientId: 's1',
            nama: 'grup',
            label: 'Grup',
            tipe: 'group',
            wajib: false,
            aktif: true,
            placeholder: null,
            deskripsi: null,
            jumlahKolom: 3,
            optionSourceType: null,
            optionSourceKey: null,
            opsi: [],
          },
        ],
      }),
    )

    expect(payload.fields[0]?.optionSourceKey).toBe('petugas')
    expect(payload.fields[1]?.tipe).toBe('group')
    expect(payload.fields[1]?.jumlahKolom).toBe(3)
    expect(payload.actorId).toBeNull()
    expect(payload.formVersionId).toBe('fv-1')
  })

  it('deskripsi/placeholder null/undefined mengikuti perilaku trim aman', () => {
    const payload = normalisasiPayloadBuild(
      buatDokumen({
        sections: [
          { id: 's1', clientId: 's1', nama: 'S', deskripsi: null, aktif: true },
        ],
        fields: [
          {
            id: 'f1',
            clientId: 'f1',
            sectionClientId: 's1',
            nama: 'f',
            label: 'F',
            tipe: 'text',
            wajib: false,
            aktif: true,
            placeholder: undefined as unknown as string | null,
            deskripsi: undefined as unknown as string | null,
            jumlahKolom: null,
            optionSourceType: null,
            optionSourceKey: null,
            opsi: [],
          },
        ],
      }),
    )

    expect(payload.sections[0]?.deskripsi).toBeNull()
    expect(payload.fields[0]?.placeholder).toBeNull()
    expect(payload.fields[0]?.deskripsi).toBeNull()
  })
})

it('mempertahankan identitas, urutan section/field, dan kedua jenis rule pada payload server', () => {
  const document = buatDokumen({
    sections: [
      {
        id: 's2-db',
        clientId: 's2',
        nama: 'Dua',
        deskripsi: null,
        aktif: true,
      },
      {
        id: 's1-db',
        clientId: 's1',
        nama: 'Satu',
        deskripsi: null,
        aktif: false,
      },
    ],
    fields: ['f2', 'f1'].map((id) => ({
      id: `${id}-db`,
      clientId: id,
      sectionClientId: 's2',
      nama: id,
      label: id,
      tipe: 'text',
      wajib: true,
      aktif: true,
      placeholder: null,
      deskripsi: null,
      jumlahKolom: 2,
      optionSourceType: null,
      optionSourceKey: null,
      opsi: [],
    })),
    rulesAutofill: [
      {
        id: 'auto',
        triggerFieldId: 'f1',
        targetFieldId: 'f2',
        sumber: 'warga',
        kolom: 'nik',
        transform: 'nik',
        mode: 'isi_kosong',
        aktif: true,
        urutan: 3,
      },
    ],
    rulesVisibilitas: [
      {
        id: 'vis',
        triggerFieldId: 'f1',
        targetType: 'field',
        targetId: 'f2',
        operator: 'eq',
        nilaiAcuan: 'Ya',
        aktif: true,
        urutan: 2,
      },
    ],
  })
  const before = structuredClone(document)
  expect(normalisasiPayloadBuild(document)).toEqual({
    ...document,
    actorId: null,
  })
  expect(document).toEqual(before)
})
