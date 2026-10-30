// src/components/kelola/builder/PropertyPanelVisibilitas.tsx
import type {
  RuleVisibilitas,
  OperatorVisibilitas,
  TargetVisibilitas,
} from '@/lib/form-builder/engine/types'

interface FieldOption {
  id: string
  nama: string
}

interface Props {
  targetType: TargetVisibilitas // 'field' | 'section'
  targetId: string
  allFields: FieldOption[]
  rules: RuleVisibilitas[]
  onChange: (newRules: RuleVisibilitas[]) => void
  disabled?: boolean
}

export function PropertyPanelVisibilitas({
  targetType,
  targetId,
  allFields,
  rules,
  onChange,
  disabled = false,
}: Props) {
  const activeRules = rules.filter(
    (r) => r.targetType === targetType && r.targetId === targetId,
  )

  const handleAddRule = () => {
    const newRule: RuleVisibilitas = {
      id: crypto.randomUUID(),
      targetType,
      targetId,
      triggerFieldId: allFields[0]?.id || '',
      operator: 'eq',
      nilaiAcuan: '',
      aktif: true,
      urutan: activeRules.length,
    }
    onChange([...rules, newRule])
  }

  const handleUpdateRule = (id: string, updated: Partial<RuleVisibilitas>) => {
    onChange(rules.map((r) => (r.id === id ? { ...r, ...updated } : r)))
  }

  const handleDeleteRule = (id: string) => {
    onChange(rules.filter((r) => r.id !== id))
  }

  return (
    <div className="space-y-4 border-t border-line pt-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">
          Aturan Visibilitas (Show/Hide)
        </h4>
        <button
          type="button"
          onClick={handleAddRule}
          disabled={disabled || allFields.length === 0}
          className="rounded-lg bg-accent px-2.5 py-1.5 text-xs font-semibold text-on-accent hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          + Tambah Kondisi
        </button>
      </div>

      {activeRules.length === 0 ? (
        <p className="text-xs italic text-muted">
          Selalu tampil (tanpa syarat).
        </p>
      ) : (
        activeRules.map((rule, idx) => (
          <div
            key={rule.id}
            className="space-y-2 rounded-lg border border-line bg-surface p-3 text-xs"
          >
            <div className="flex justify-between items-center">
              <span className="font-medium text-ink-2">
                Tampilkan Jika #{idx + 1}
              </span>
              <button
                type="button"
                onClick={() => handleDeleteRule(rule.id)}
                disabled={disabled}
                className="text-danger hover:underline disabled:opacity-50"
              >
                Hapus
              </button>
            </div>

            {/* Trigger Field */}
            <div>
              <label className="mb-1 block text-ink-2">Field Pemicu:</label>
              <select
                value={rule.triggerFieldId}
                disabled={disabled}
                onChange={(e) =>
                  handleUpdateRule(rule.id, { triggerFieldId: e.target.value })
                }
                className="w-full rounded-md border border-line bg-surface px-2 py-1.5 text-ink outline-none focus:border-accent"
              >
                {allFields.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nama} ({f.id})
                  </option>
                ))}
              </select>
            </div>

            {/* Operator & Nilai Acuan */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-ink-2">Operator:</label>
                <select
                  value={rule.operator}
                  disabled={disabled}
                  onChange={(e) =>
                    handleUpdateRule(rule.id, {
                      operator: e.target.value as OperatorVisibilitas,
                    })
                  }
                  className="w-full rounded-md border border-line bg-surface px-2 py-1.5 text-ink outline-none focus:border-accent"
                >
                  <option value="eq">Sama Dengan (=)</option>
                  <option value="neq">Tidak Sama (!=)</option>
                  <option value="kosong">Kosong</option>
                  <option value="tidak_kosong">Tidak Kosong</option>
                </select>
              </div>

              {rule.operator !== 'kosong' &&
                rule.operator !== 'tidak_kosong' && (
                  <div>
                    <label className="mb-1 block text-ink-2">
                      Nilai Acuan:
                    </label>
                    <input
                      type="text"
                      value={String(rule.nilaiAcuan ?? '')}
                      disabled={disabled}
                      onChange={(e) =>
                        handleUpdateRule(rule.id, {
                          nilaiAcuan: e.target.value,
                        })
                      }
                      className="w-full rounded-md border border-line bg-surface px-2 py-1.5 text-ink outline-none focus:border-accent"
                      placeholder="misal: Ya"
                    />
                  </div>
                )}
            </div>
          </div>
        ))
      )}
      <p className="text-[11px] text-muted">
        Aturan disimpan saat form di-build.
      </p>
    </div>
  )
}
