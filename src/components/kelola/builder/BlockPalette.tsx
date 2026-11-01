import { useDraggable } from '@dnd-kit/react'
import { ikonUntuk } from './ikon-builder'
import type { PaletteItem } from './types'
import {
  idDragTemplate,
  templatePerKelompok,
} from '@/lib/service/form-builder/template-field'
import type { TemplateField } from '@/lib/service/form-builder/template-field'

export function BlockPalette({
  items,
  onDragStart,
  disabled,
  onAddField,
  onAddTemplate,
}: {
  items: PaletteItem[]
  onDragStart?: () => void
  disabled?: boolean
  onAddField: (item: PaletteItem) => void
  onAddTemplate: (template: TemplateField) => void
}) {
  const kelompokTemplate = templatePerKelompok()

  return (
    <div className="h-full min-h-0 w-60 shrink-0 overflow-y-auto overflow-x-hidden border-r border-line bg-surface-2 p-3 max-md:w-full max-md:border-r-0">
      <h3 className="text-xs font-semibold text-ink-2 uppercase tracking-wide mb-2">
        Komponen
      </h3>
      <p className="mb-3 text-[11px] leading-relaxed text-muted">
        Klik untuk menambahkan ke section aktif, atau tarik ke canvas.
      </p>
      <div className="grid gap-2">
        {items.map((item) => (
          <PaletteItemDraggable
            key={item.tipe}
            item={item}
            onDragStart={onDragStart}
            disabled={disabled}
            onAdd={() => onAddField(item)}
          />
        ))}
      </div>

      {kelompokTemplate.length > 0 && (
        <>
          <h3 className="text-xs font-semibold text-ink-2 uppercase tracking-wide mt-5 mb-1">
            Siap pakai
          </h3>
          <p className="text-[10px] leading-snug text-muted mb-2">
            Tarik ke section, field langsung jadi lengkap — nama teknis dan
            daftar jawabannya sudah terisi.
          </p>
          {kelompokTemplate.map((group) => (
            <div key={group.kelompok} className="mb-3 last:mb-0">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-1.5">
                {group.kelompok}
              </div>
              <div className="grid gap-1.5">
                {group.daftar.map((template) => (
                  <TemplateDraggable
                    key={template.id}
                    template={template}
                    onDragStart={onDragStart}
                    disabled={disabled}
                    onAdd={() => onAddTemplate(template)}
                  />
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

function PaletteItemDraggable({
  item,
  onDragStart,
  disabled,
  onAdd,
}: {
  item: PaletteItem
  onDragStart?: () => void
  disabled?: boolean
  onAdd: () => void
}) {
  const Icon = ikonUntuk(item.icon)
  const { ref, isDragging } = useDraggable({
    id: `palette-${item.tipe}`,
    type: 'palette',
    data: { kind: 'palette', fieldType: item.tipe },
    disabled,
  })

  return (
    <button
      type="button"
      ref={ref}
      onDragStart={onDragStart}
      onClick={onAdd}
      disabled={disabled}
      className="group flex w-full cursor-grab items-center gap-2 rounded-lg border border-line bg-surface p-2.5 text-left transition-all hover:border-accent-border hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
      style={{ opacity: isDragging ? 0.5 : 1 }}
    >
      <div className="w-8 h-8 flex items-center justify-center rounded border border-line bg-accent-light">
        <Icon className="w-4 h-4 text-accent" strokeWidth={2} />
      </div>
      <span className="flex-1 text-sm font-medium text-ink truncate">
        {item.label}
      </span>
    </button>
  )
}

/**
 * Satu template siap pakai.
 *
 * Ikon memakai nama ikon dari katalog, bukan tipe field: dua template sama-sama
 * `radio` (mis. agama dan pendidikan) butuh ikon berbeda supaya mudah dibedakan
 * saat memilih.
 */
function TemplateDraggable({
  template,
  onDragStart,
  disabled,
  onAdd,
}: {
  template: TemplateField
  onDragStart?: () => void
  disabled?: boolean
  onAdd: () => void
}) {
  const Icon = ikonUntuk(template.ikon)
  const { ref, isDragging } = useDraggable({
    id: idDragTemplate(template.id),
    type: 'template',
    data: { kind: 'template', templateId: template.id },
    disabled,
  })

  return (
    <button
      type="button"
      ref={ref}
      onDragStart={onDragStart}
      onClick={onAdd}
      disabled={disabled}
      title={`${template.nama} — ${template.hint}`}
      className="group flex w-full cursor-grab items-center gap-2 rounded-lg border border-dashed border-accent-border bg-accent-light/40 p-2 text-left transition-all hover:border-accent hover:bg-accent-light hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
      style={{ opacity: isDragging ? 0.5 : 1 }}
    >
      <div className="w-7 h-7 flex items-center justify-center rounded border border-line bg-surface shrink-0">
        <Icon className="w-3.5 h-3.5 text-accent" strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-ink truncate">
          {template.label}
        </div>
        <div className="text-[10px] text-muted font-mono truncate">
          {template.nama}
        </div>
      </div>
    </button>
  )
}
