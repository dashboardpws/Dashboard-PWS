import { useSortable } from '@dnd-kit/react/sortable'
import { Plus, Trash2, GripVertical, FolderOpen } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { DraftSection, FlatNode, DraftField } from './types'
import { SECTION_GROUP } from './tree'
import { FieldNode } from './FieldNode'

interface Props {
  section: DraftSection
  flatTree: FlatNode[]
  index: number
  disabled?: boolean
  isSelected: boolean
  fieldsByClientId: Map<string, DraftField>
  onSelect: (clientId: string) => void
  onSelectField: (clientId: string) => void
  onDeselectField: () => void
  selectedFieldClientId: string | null
  previewValues: Record<string, unknown>
  onPreviewChange: (fieldClientId: string, value: unknown) => void
  onAddField: (sectionClientId: string) => void
  onUpdateSection: (clientId: string, patch: Partial<DraftSection>) => void
  /** undefined = form ini mengunci struktur section, jadi tombolnya disembunyikan. */
  onDeleteSection?: (clientId: string) => void
  /** undefined = field ini tidak boleh dihapus, jadi tombolnya disembunyikan. */
  onDeleteField?: (clientId: string) => void
}

export function SectionNode({
  section,
  flatTree,
  index,
  disabled,
  isSelected,
  fieldsByClientId,
  onSelect,
  onSelectField,
  onDeselectField,
  selectedFieldClientId,
  previewValues,
  onPreviewChange,
  onAddField,
  onUpdateSection,
  onDeleteSection,
  onDeleteField,
}: Props) {
  // Terima section (reorder) + field (pindah masuk) + palette (buat field baru).
  const { ref, isDropTarget, isDragging } = useSortable({
    id: section.clientId,
    index,
    group: SECTION_GROUP,
    type: 'section',
    accept: ['palette', 'template', 'section', 'field'],
    data: { kind: 'section', clientId: section.clientId },
    disabled,
  })

  const fields = flatTree.filter(
    (n) => n.kind === 'field' && n.parentKey === section.clientId,
  )

  return (
    <div
      ref={ref}
      className="relative"
      style={{ opacity: isDragging ? 0.5 : 1 }}
    >
      <div
        className={`flex items-center gap-2 rounded-xl border p-3 transition-colors ${
          isSelected
            ? 'border-accent-border bg-accent-light/70'
            : 'border-line bg-surface hover:border-accent-border'
        } ${isDropTarget ? 'bg-accent-light/50 border-accent-border' : ''}`}
        onClick={() => onSelect(section.clientId)}
      >
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <div className="w-4 h-4 shrink-0" />
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <GripVertical className="w-4 h-4 text-muted cursor-grab opacity-0 group-hover:opacity-100" />
            <FolderOpen className="w-4 h-4 text-accent shrink-0" />
            <Input
              value={section.nama}
              onChange={(e) => {
                e.stopPropagation()
                onUpdateSection(section.clientId, { nama: e.target.value })
              }}
              className="flex-1 min-w-0 bg-transparent border-0 focus:ring-0 text-sm font-medium text-ink placeholder:text-muted"
              placeholder="Nama section"
            />
            {section.id && (
              <span className="text-[10px] text-muted font-mono px-1.5 py-0.5 rounded bg-line">
                {section.id.slice(0, 8)}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation()
              onAddField(section.clientId)
            }}
          >
            <Plus className="w-3 h-3" /> Field
          </Button>
          {onDeleteSection ? (
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:bg-destructive/10"
              onClick={(e) => {
                e.stopPropagation()
                onDeleteSection(section.clientId)
              }}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          ) : null}
        </div>
      </div>

      {section.deskripsi && (
        <div className="mt-1 ml-6 text-xs text-muted italic border-l border-line pl-2">
          {section.deskripsi}
        </div>
      )}

      <div className="ml-3 grid gap-2 border-l border-line pl-3 sm:ml-5 sm:pl-4">
        {fields.map((f, idx) => {
          const field = fieldsByClientId.get(f.clientId)
          if (!field) return null
          return (
            <FieldNode
              key={f.clientId}
              fieldClientId={f.clientId}
              index={idx}
              disabled={disabled}
              field={field}
              isSelected={selectedFieldClientId === f.clientId}
              onSelect={onSelectField}
              onDeselect={onDeselectField}
              onDeleteField={onDeleteField}
              previewValue={previewValues[f.clientId]}
              onPreviewChange={(value) => onPreviewChange(f.clientId, value)}
            />
          )
        })}
        {fields.length === 0 && (
          <div className="rounded-xl border border-dashed border-line bg-surface/70 px-4 py-5 text-center text-xs text-muted">
            Belum ada pertanyaan. Klik Komponen atau tarik field ke section ini.
          </div>
        )}
      </div>
    </div>
  )
}
