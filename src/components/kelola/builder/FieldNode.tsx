import { useSortable } from '@dnd-kit/react/sortable'
import {
  GripVertical,
  Trash2,
  Settings,
  AlertTriangle,
  EyeOff,
  Database,
  Lightbulb,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { DraftField } from './types'
import { TIPE_FIELD_LABELS, TIPE_BUTUH_OPSI } from './types'
import {
  cariSumber,
  SUMBER_SUGGEST,
} from '@/lib/service/form-builder/sumber-opsi'
import { DynamicField } from '@/components/survey/DynamicField'
import { fieldKeRuntime } from '@/components/kelola/builder/preview/draft-ke-runtime'

interface Props {
  fieldClientId: string
  index: number
  disabled?: boolean
  field: DraftField
  isSelected: boolean
  onSelect: (clientId: string) => void
  onDeselect: () => void
  /** undefined = field ini tidak boleh dihapus, jadi tombolnya disembunyikan. */
  onDeleteField?: (clientId: string) => void
  previewValue: unknown
  onPreviewChange: (value: unknown) => void
}

export function FieldNode({
  fieldClientId,
  index,
  disabled,
  field,
  isSelected,
  onSelect,
  onDeselect,
  onDeleteField,
  previewValue,
  onPreviewChange,
}: Props) {
  // Terima field (reorder) + palette (buat baru via section induk — lihat hook).
  // Section ditolak: accept hanya field dan palette.
  const { ref, isDragging, isDropTarget } = useSortable({
    id: fieldClientId,
    index,
    group: field.sectionClientId,
    type: 'field',
    accept: ['palette', 'template', 'field'],
    data: { kind: 'field', clientId: fieldClientId },
    disabled,
  })

  const needsOptions = TIPE_BUTUH_OPSI.includes(field.tipe)
  const hasOptions = field.opsi.some((o) => o.value.trim() && o.aktif)
  // Field yang memakai sumber tidak punya baris opsi di form_field_options, jadi
  // "butuh opsi jawaban" tidak boleh menyala hanya karena `opsi` kosong.
  const source = cariSumber(field.optionSourceType, field.optionSourceKey)
  const sumberDipakai =
    field.optionSourceType === SUMBER_SUGGEST || source !== null
  const fieldPreview = fieldKeRuntime(field, index)

  // Canvas hanya untuk mencoba bentuk input. Pencarian warga tetap milik alur
  // pengisian petugas dan tidak boleh membuat request ketika admin mengetik.
  fieldPreview.cariWarga = null

  return (
    <div
      ref={ref}
      style={{ opacity: isDragging ? 0.4 : 1 }}
      className={`relative group rounded-xl border p-3 transition-all ${
        isSelected
          ? 'border-accent-border bg-accent-light/70 shadow-sm'
          : 'border-line bg-surface hover:border-accent-border hover:shadow-sm'
      } ${isDropTarget && !isDragging ? 'bg-accent-light/50 border-accent-border' : ''}`}
      onClick={() => onSelect(fieldClientId)}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted opacity-50 transition-opacity group-hover:opacity-100" />
          <span className="rounded-md bg-surface-2 px-2 py-1 text-[10px] font-semibold text-muted">
            {TIPE_FIELD_LABELS[field.tipe]}
          </span>
          {needsOptions && !hasOptions && !sumberDipakai && (
            <AlertTriangle className="w-3 h-3 text-warning">
              <title>Butuh opsi jawaban</title>
            </AlertTriangle>
          )}
          {field.wajib && (
            <span className="text-red-500" title="Wajib">
              *
            </span>
          )}
          {!field.aktif && (
            <EyeOff className="w-3 h-3 text-muted">
              <title>Nonaktif</title>
            </EyeOff>
          )}
          {field.id && (
            <span className="text-[10px] text-muted font-mono px-1.5 py-0.5 rounded bg-line">
              {field.id.slice(0, 8)}
            </span>
          )}
        </div>
      </div>

      <div
        className="pointer-events-auto"
        onClick={() => onSelect(fieldClientId)}
      >
        <DynamicField
          field={fieldPreview}
          value={previewValue}
          onChange={onPreviewChange}
        />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-muted">
        {field.tipe === 'group' && field.jumlahKolom ? (
          <span>{field.jumlahKolom} kolom</span>
        ) : null}
        {field.optionSourceType === SUMBER_SUGGEST ? (
          <span className="inline-flex items-center gap-1">
            <Lightbulb className="h-3 w-3" />
            {hasOptions
              ? `${field.opsi.filter((o) => o.aktif && o.value).length} saran`
              : 'tanpa saran'}
          </span>
        ) : source ? (
          <span
            className="inline-flex items-center gap-1"
            title={
              source.perluServer
                ? 'Dibaca dari database saat form diisi'
                : 'Daftar tetap dari enum data warga'
            }
          >
            <Database className="h-3 w-3" />
            {source.label}
          </span>
        ) : null}
        {hasOptions && !sumberDipakai ? (
          <span>
            {field.opsi.filter((o) => o.aktif && o.value).length} opsi
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation()
            if (isSelected) {
              onDeselect()
            } else {
              onSelect(fieldClientId)
            }
          }}
        >
          <Settings className="w-3 h-3" />
        </Button>
        {onDeleteField ? (
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:bg-destructive/10"
            onClick={(e) => {
              e.stopPropagation()
              onDeleteField(fieldClientId)
            }}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        ) : null}
      </div>
    </div>
  )
}
