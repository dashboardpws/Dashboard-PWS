import { createDefaultKunjunganRumahTemplates } from '@/lib/kunjungan-rumah/template/kunjungan-rumah-templates'
import type { KunjunganRumahFoto } from '@/lib/kunjungan-rumah/models'
import type { ValidateInput } from './validate-kunjungan-rumah'

const templates = createDefaultKunjunganRumahTemplates()

const foto: KunjunganRumahFoto = {
  id: 'f1',
  name: 'kunjungan.jpg',
  dataUrl: 'data:image/jpeg;base64,AAA',
  caption: '',
  takenAt: '2026-02-14T08:00:00.000Z',
}

export function validInput(): ValidateInput {
  return {
    info: {
      tglPengumpulan: '2026-02-14',
      alamat: 'Jl. Ngemplakrejo gg. III no. 12',
      kelurahan: 'Ngemplakrejo',
      kecamatan: 'Trajeng',
      kabKota: 'Kota Pasuruan',
      provinsi: 'Jawa Timur',
      hpKK: '081234567890',
      puskesmas: 'Puskesmas Trajeng',
      pustu: '',
      posyandu: 'Mawar 2',
      namaKK: 'Bpk. Salim',
      nik: '3579015202800001',
      petugasId: 'sv1',
      petugasNama: 'Siti Aminah',
    },
    anggota: [
      {
        id: 'a1',
        nama: 'Budi Setiawan',
        nik: '3579015202800001',
        tglLahir: '1980-02-15',
        jk: 'L',
        hubKK: 'Anak',
        statusKawin: 'Kawin',
        pendidikan: 'SMA',
        pekerjaan: 'Buruh',
      },
    ],
    penilaian: [
      {
        id: 'p1',
        anggotaId: 'a1',
        sasaran: 'dewasa',
        values: {},
        checks: {},
        prioritas: [],
      },
    ],
    masalah: [],
    hasil: templates.hasilOpsi[0] ?? '',
    jadwal: '',
    ttd: 'Siti Aminah',
    fotos: [foto],
    templates: createDefaultKunjunganRumahTemplates(),
  }
}
