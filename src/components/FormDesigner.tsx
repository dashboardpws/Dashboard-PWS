/**
 * ============================================================================
 * 🧩 KOMPONEN: FormDesigner (Dynamic & Metadata-Driven)
 * ============================================================================
 *
 * 🎯 TUJUAN UTAMA:
 * Membangun visual form builder interaktif yang menghasilkan JSON Schema dinamis.
 * Fitur utama komponen ini adalah "Auto-fill Engine" berbasis metadata, yang
 * memungkinkan pengisian form otomatis dari database warga TANPA perlu hardcode ID field.
 *
 * 🔄 ALUR KERJA (WORKFLOW):
 * 1. Admin menyusun field via Toolbar -> merender komponen di Interactive Canvas.
 * 2. Admin mengkonfigurasi metadata di Properties Panel:
 *    - `isSearchTrigger`: Menandai field sebagai pemicu pencarian warga (misal: NIK).
 *    - `targetMapping`: Menandai target kolom database (misal: 'nama_kk', 'alamat').
 * 3. Saat pengguna mengisi form di Canvas dan memilih data dari SaranWargaDropdown:
 *    - Engine `pilihSaran` membaca metadata dari semua field yang ada.
 *    - Data warga otomatis dipetakan dan menimpa state `formData` secara dinamis.
 *
 * 🚀 RENCANA KEDEPAN (NEXT STEPS):
 * 1. Menghubungkan field pemicu (`isSearchTrigger`) dengan API pencarian server secara real-time.
 * 2. Menambahkan debounce (300ms) dan Request Guard (`AbortController`) pada input pemicu.
 * 3. Penanganan pencarian paralel untuk data keluarga & riwayat kesehatan.
 *
 * 🏁 GOALS:
 * Fleksibilitas penuh! Admin bebas menambah, merubah, atau menghapus field pada Form
 * tanpa merusak atau perlu mengubah kode logika Auto-fill & Simpan di backend.
 * ============================================================================
 */

import React, { useState } from 'react'
import {
  Box,
  Card,
  Group,
  Stack,
  Text,
  Title,
  Paper,
  ActionIcon,
  Code,
  TextInput,
  Switch,
  Badge,
  Textarea,
  NumberInput,
  Select,
  Checkbox,
  Divider,
} from '@mantine/core'
import { Button } from '@/components/ui/Button'
import {
  Trash2,
  Code2,
  Type,
  CheckSquare,
  ListFilter,
  Hash,
  AlignLeft,
  Eye,
} from 'lucide-react'
import { SaranWargaDropdown } from './survey/SaranWargaDropdown'
import type { SasaranSuggestion } from '@/lib/kunjungan-rumah/sasaran/warga-row'

/**
 * Tipe data untuk konfigurasi 1 field pada form.
 */
export type FormField = {
  id: string // Unique ID internal canvas (misal: 'field_17000000')
  component: string // Tipe komponen UI ('input-text', 'select', 'checkbox', dll)
  name: string // Key JSON untuk data hasil input ('nik', 'nama_lengkap', dll)
  label: string // Label tampilan di UI
  placeholder?: string
  required?: boolean
  options?: string // Pilihan dropdown (pisahkan dengan koma)

  // 🔍 Metadata untuk mengendalikan fitur Auto-Fill Warga secara dinamis
  meta?: {
    isSearchTrigger?: boolean // True jika field ini memicu pencarian otomatis saat diketik
    targetMapping?: string // Kolom DB target hasil autofill ('nik', 'nama_kk', 'alamat', dll)
  }
}

export function FormDesigner() {
  // --------------------------------------------------------------------------
  // 🟢 STATE MANAGEMENT
  // --------------------------------------------------------------------------
  const [fields, setFields] = useState<FormField[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // State penyimpan data input interaktif pengguna { [fieldName]: value }
  const [formData, setFormData] = useState<Record<string, any>>({})

  // State untuk pencarian data warga & kontrol UI Dropdown
  const [saranRows, setSaranRows] = useState<SasaranSuggestion[]>([])
  const [isBusy] = useState<boolean>(false)

  // --------------------------------------------------------------------------
  // 🛠️ HANDLER: Aksi Tambah & Hapus Field
  // --------------------------------------------------------------------------

  /** 1. Menambahkan field baru ke Canvas dari Toolbar */
  const handleAddField = (type: string, defaultLabel: string) => {
    const id = `field_${Date.now()}`
    const newField: FormField = {
      id,
      component: type,
      name: `${type.replace('-', '_')}_${fields.length + 1}`,
      label: `${defaultLabel} ${fields.length + 1}`,
      placeholder: type === 'checkbox' ? undefined : 'Ketik di sini...',
      required: false,
      options:
        type === 'select' ? 'Pilihan A, Pilihan B, Pilihan C' : undefined,
    }
    setFields((prev) => [...prev, newField])
    setSelectedId(id) // Langsung pilih field baru untuk di-edit
  }

  /** 2. Menghapus field dari Canvas + Cleanup data input terkait */
  const handleRemoveField = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()

    // Hapus data dari formData agar tidak meninggalkan memori sampah
    const fieldToRemove = fields.find((f) => f.id === id)
    if (fieldToRemove) {
      setFormData((prevData) => {
        const newData = { ...prevData }
        delete newData[fieldToRemove.name]
        return newData
      })
    }

    setFields((prev) => prev.filter((f) => f.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  // --------------------------------------------------------------------------
  // ⚡ HANDLER: Auto-Fill Engine Dinamis
  // --------------------------------------------------------------------------

  /**
   * Eksekutor Auto-fill: Membaca metadata seluruh field dan memetakan data warga
   * yang dipilih dari dropdown langsung ke `formData` (Selalu menimpa nilai lama).
   */
  const pilihSaran = (selectedWarga: SasaranSuggestion) => {
    setFormData((prevData) => {
      const nextData = { ...prevData }

      // Iterasi semua field dan periksa apakah memiliki `targetMapping`
      fields.forEach((field) => {
        const target = field.meta?.targetMapping

        if (target) {
          const key = target as keyof SasaranSuggestion

          // Jika properti cocok dengan data warga, timpa nilainya ke formData
          if (key in selectedWarga) {
            const val = selectedWarga[key]
            if (val !== undefined && val !== null) {
              nextData[field.name] = val
            }
          }
        }
      })

      return nextData
    })

    // Tutup dropdown setelah data terpilih
    setSaranRows([])
  }

  // --------------------------------------------------------------------------
  // ⚙️ HANDLER: Update Properti & Metadata Field
  // --------------------------------------------------------------------------

  /** Update properti umum (label, name, placeholder, required, dll) */
  const handleUpdateProperty = <TKey extends keyof FormField>(
    key: TKey,
    value: FormField[TKey],
  ) => {
    setFields((prev) =>
      prev.map((field) => {
        if (field.id === selectedId) {
          // Jika `name` (Key JSON) diubah, migrasikan value di formData ke key baru
          if (
            key === 'name' &&
            typeof value === 'string' &&
            field.name !== value
          ) {
            setFormData((prevData) => {
              const newData = { ...prevData }
              if (field.name in newData) {
                newData[value] = newData[field.name] // Salin ke key baru
                delete newData[field.name] // Hapus key lama
              }
              return newData
            })
          }
          return { ...field, [key]: value }
        }
        return field
      }),
    )
  }

  /** Helper khusus untuk memperbarui properti di dalam objek `meta` */
  const handleUpdateMeta = (metaKey: string, value: any) => {
    if (!selectedField) return

    const currentMeta = selectedField.meta || {}
    const updatedMeta = {
      ...currentMeta,
      [metaKey]: value,
    }

    handleUpdateProperty('meta', updatedMeta)
  }

  // --------------------------------------------------------------------------
  // 🎨 RENDERER: Tampilan Interaktif Field di Canvas
  // --------------------------------------------------------------------------
  const renderInteractiveComponent = (field: FormField) => {
    const parsedOptions = field.options
      ? field.options.split(',').map((opt) => opt.trim())
      : []

    switch (field.component) {
      case 'input-text':
        return (
          <TextInput
            label={field.label}
            placeholder={field.placeholder}
            withAsterisk={field.required}
            value={formData[field.name] || ''}
            onChange={(e) =>
              setFormData({ ...formData, [field.name]: e.currentTarget.value })
            }
          />
        )
      case 'textarea':
        return (
          <Textarea
            label={field.label}
            placeholder={field.placeholder}
            withAsterisk={field.required}
            value={formData[field.name] || ''}
            onChange={(e) =>
              setFormData({ ...formData, [field.name]: e.currentTarget.value })
            }
          />
        )
      case 'input-number':
        return (
          <NumberInput
            label={field.label}
            placeholder={field.placeholder}
            withAsterisk={field.required}
            value={formData[field.name] ?? ''}
            onChange={(val) => setFormData({ ...formData, [field.name]: val })}
          />
        )
      case 'select':
        return (
          <Select
            label={field.label}
            placeholder={field.placeholder}
            withAsterisk={field.required}
            data={parsedOptions}
            value={formData[field.name] || null}
            onChange={(val) => setFormData({ ...formData, [field.name]: val })}
          />
        )
      case 'checkbox':
        return (
          <Checkbox
            label={field.label}
            checked={!!formData[field.name]}
            onChange={(e) =>
              setFormData({
                ...formData,
                [field.name]: e.currentTarget.checked,
              })
            }
          />
        )
      default:
        return null
    }
  }

  const selectedField = fields.find((f) => f.id === selectedId)

  // Transformasi struktur field internal menjadi JSON Schema standar
  const letsFormSchema = {
    components: fields.map(({ id, options, ...rest }) => {
      if (rest.component === 'select' && options) {
        return {
          ...rest,
          options: options.split(',').map((opt) => ({
            label: opt.trim(),
            value: opt.trim().toLowerCase().replace(/\s+/g, '_'),
          })),
        }
      }
      return rest
    }),
  }

  // --------------------------------------------------------------------------
  // 🖥️ TAMPILAN UTAMA (LAYOUT)
  // --------------------------------------------------------------------------
  return (
    <Box p="md" style={{ maxWidth: 1200, margin: '0 auto' }}>
      <Title order={2} mb="lg">
        🛠️ Form Designer & Interactive Canvas
      </Title>

      <Group align="flex-start" gap="md">
        {/* ================= 1. TOOLBAR (Panel Tambah Field) ================= */}
        <Paper shadow="xs" p="md" withBorder style={{ width: 220 }}>
          <Text fw={700} mb="sm">
            Toolbar 🧰
          </Text>
          <Stack gap="xs">
            <Button
              variant="default"
              leftSection={<Type size={16} />}
              onClick={() => handleAddField('input-text', 'Text Input')}
              fullWidth
            >
              + Text Input
            </Button>
            <Button
              variant="default"
              leftSection={<AlignLeft size={16} />}
              onClick={() => handleAddField('textarea', 'Textarea')}
              fullWidth
            >
              + Textarea
            </Button>
            <Button
              variant="default"
              leftSection={<Hash size={16} />}
              onClick={() => handleAddField('input-number', 'Number Input')}
              fullWidth
            >
              + Number
            </Button>
            <Button
              variant="default"
              leftSection={<ListFilter size={16} />}
              onClick={() => handleAddField('select', 'Dropdown Select')}
              fullWidth
            >
              + Select
            </Button>
            <Button
              variant="default"
              leftSection={<CheckSquare size={16} />}
              onClick={() => handleAddField('checkbox', 'Checkbox')}
              fullWidth
            >
              + Checkbox
            </Button>
          </Stack>
        </Paper>

        {/* ================= 2. CANVAS (Area Preview Form) ================= */}
        <Paper
          shadow="xs"
          p="md"
          withBorder
          style={{ flex: 1, minHeight: 450 }}
        >
          <Group justify="space-between" mb="sm">
            <Text fw={700}>Interactive Canvas 🎨</Text>
            <Badge color="blue" variant="light" leftSection={<Eye size={12} />}>
              Live Preview
            </Badge>
          </Group>

          {fields.length === 0 ? (
            <Text c="dimmed" ta="center" py="xl">
              Canvas masih kosong. Tambahkan komponen dari Toolbar.
            </Text>
          ) : (
            <Stack gap="md">
              {fields.map((field, index) => {
                const isSelected = field.id === selectedId
                return (
                  <Card
                    key={field.id}
                    shadow="xs"
                    padding="md"
                    radius="md"
                    withBorder
                    style={{
                      cursor: 'pointer',
                      borderColor: isSelected
                        ? 'var(--mantine-color-blue-6)'
                        : undefined,
                      backgroundColor: isSelected
                        ? 'var(--mantine-color-blue-0)'
                        : undefined,
                    }}
                    onClick={() => setSelectedId(field.id)}
                  >
                    <Group justify="space-between" mb="xs">
                      <Group gap="xs">
                        <Badge size="xs" variant="filled">
                          #{index + 1}
                        </Badge>
                        <Text fz="xs" c="dimmed">
                          Key: <Code>{field.name}</Code>
                        </Text>
                      </Group>
                      <ActionIcon
                        color="red"
                        variant="subtle"
                        onClick={(e) => handleRemoveField(field.id, e)}
                      >
                        <Trash2 size={16} />
                      </ActionIcon>
                    </Group>

                    <Box style={{ pointerEvents: 'auto' }}>
                      {renderInteractiveComponent(field)}
                    </Box>
                  </Card>
                )
              })}
            </Stack>
          )}
        </Paper>

        {/* ================= 3. PROPERTIES PANEL (Pengaturan Metadata) ================= */}
        <Paper shadow="xs" p="md" withBorder style={{ width: 280 }}>
          <Text fw={700} mb="sm">
            Pengaturan Field ⚙️
          </Text>
          {selectedField ? (
            <Stack gap="sm">
              <TextInput
                label="Label Field"
                value={selectedField.label}
                onChange={(e) =>
                  handleUpdateProperty('label', e.currentTarget.value)
                }
              />

              <TextInput
                label="Field Name (Key JSON)"
                value={selectedField.name}
                onChange={(e) =>
                  handleUpdateProperty('name', e.currentTarget.value)
                }
              />

              {selectedField.component !== 'checkbox' && (
                <TextInput
                  label="Placeholder"
                  value={selectedField.placeholder || ''}
                  onChange={(e) =>
                    handleUpdateProperty('placeholder', e.currentTarget.value)
                  }
                />
              )}

              {selectedField.component === 'select' && (
                <Textarea
                  label="Pilihan Dropdown (Pisah Koma)"
                  value={selectedField.options || ''}
                  onChange={(e) =>
                    handleUpdateProperty('options', e.currentTarget.value)
                  }
                  rows={3}
                />
              )}

              <Switch
                label="Wajib Diisi (Required)"
                checked={!!selectedField.required}
                onChange={(e) =>
                  handleUpdateProperty('required', e.currentTarget.checked)
                }
                mt="xs"
              />

              <Divider
                my="xs"
                label="Konfigurasi Auto-Fill 🤖"
                labelPosition="center"
              />

              {/* Toggle Pemicu Auto-fill */}
              <Switch
                label="Jadikan Pemicu Auto-fill Warga 🔍"
                description="Menampilkan dropdown pencarian warga saat diisi"
                checked={!!selectedField.meta?.isSearchTrigger}
                onChange={(e) =>
                  handleUpdateMeta('isSearchTrigger', e.currentTarget.checked)
                }
              />

              {/* Target Mapping Kolom Database */}
              <Select
                label="Target Kolom Database 🎯"
                placeholder="Pilih target kolom..."
                description="Ke mana data dari saran warga akan dimasukkan"
                data={[
                  { value: 'nik', label: 'NIK' },
                  { value: 'nama_kk', label: 'Nama Kepala Keluarga' },
                  { value: 'nama_art', label: 'Nama Anggota Keluarga' },
                  { value: 'alamat', label: 'Alamat Rumah' },
                  { value: 'rt', label: 'RT' },
                  { value: 'rw', label: 'RW' },
                  { value: 'kelurahan', label: 'Kelurahan' },
                  { value: 'kecamatan', label: 'Kecamatan' },
                ]}
                value={selectedField.meta?.targetMapping || null}
                onChange={(val) =>
                  handleUpdateMeta('targetMapping', val || undefined)
                }
                clearable
              />
            </Stack>
          ) : (
            <Text c="dimmed" fz="sm">
              Klik salah satu card di Canvas untuk mengedit propertinya.
            </Text>
          )}
        </Paper>
      </Group>

      {/* ================= 4. OUTPUT JSON & STATE ================= */}
      <Group grow mt="md" align="flex-start">
        <Paper shadow="xs" p="md" withBorder style={{ flex: 1 }}>
          <Group gap="xs" mb="xs">
            <Code2 size={18} />
            <Text fw={700}>Hasil JSON Schema (LetsForm):</Text>
          </Group>
          <Code block style={{ maxHeight: 200, overflow: 'auto' }}>
            {JSON.stringify(letsFormSchema, null, 2)}
          </Code>
        </Paper>

        <Paper shadow="xs" p="md" withBorder style={{ flex: 1 }}>
          <Group gap="xs" mb="xs">
            <Eye size={18} />
            <Text fw={700}>State Form Real-time (Isi User):</Text>
          </Group>
          <Code block style={{ maxHeight: 200, overflow: 'auto' }}>
            {JSON.stringify(formData, null, 2)}
          </Code>
        </Paper>
      </Group>

      {/* ================= DROPDOWN SARAN WARGA ================= */}
      {saranRows.length > 0 && (
        <Box mt="md" style={{ position: 'relative', maxWidth: 400 }}>
          <SaranWargaDropdown
            rows={saranRows}
            busy={isBusy}
            onPilih={(row) => pilihSaran(row)}
            onTutup={() => setSaranRows([])}
          />
        </Box>
      )}
    </Box>
  )
}
