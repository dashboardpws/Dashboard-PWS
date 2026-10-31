import { KOLOM_WARGA } from '@/lib/form-builder/rules/autofill-katalog'
import type {
  RuleAutofill,
  SumberAutofill,
  TransformAutofill,
  ModeAutofill,
} from '@/lib/form-builder/engine/types'

interface FieldOption {
  id: string
  nama: string
}

interface Props {
  triggerFieldId: string
  allFields: FieldOption[]
  rules: RuleAutofill[]
  onChange: (newRules: RuleAutofill[]) => void
  disabled?: boolean
  canAdd?: boolean
  catatan?: string
}

export function PropertyPanelAutofill({
  triggerFieldId,
  allFields,
  rules,
  onChange,
  disabled = false,
  canAdd = true,
  catatan,
}: Props) {
  // Filter aturan yang hanya berlaku untuk triggerFieldId ini
  const activeRules = rules.filter((r) => r.triggerFieldId === triggerFieldId)

  const handleAddRule = () => {
    const newRule: RuleAutofill = {
      id: crypto.randomUUID(),
      triggerFieldId,
      targetFieldId: allFields.find((f) => f.id !== triggerFieldId)?.id || '',
      sumber: 'warga',
      kolom: 'nik',
      transform: 'teks',
      mode: 'isi_kosong',
      aktif: true,
      urutan: activeRules.length,
    }
    onChange([...rules, newRule])
  }

  const handleUpdateRule = (id: string, updated: Partial<RuleAutofill>) => {
    onChange(rules.map((r) => (r.id === id ? { ...r, ...updated } : r)))
  }

  const handleDeleteRule = (id: string) => {
    onChange(rules.filter((r) => r.id !== id))
  }

  return (
    <div className="space-y-4 border-t border-line pt-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-ink">Aturan Auto-Fill</h4>
        <button
          type="button"
          onClick={handleAddRule}
          disabled={disabled || !canAdd || allFields.length < 2}
          className="rounded-lg bg-accent px-2.5 py-1.5 text-xs font-semibold text-on-accent hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          + Tambah Target
        </button>
      </div>

      {activeRules.length === 0 ? (
        <p className="text-xs italic text-muted">
          Belum ada target auto-fill untuk field ini.
        </p>
      ) : (
        activeRules.map((rule, idx) => (
          <div
            key={rule.id}
            className="space-y-2 rounded-lg border border-line bg-surface p-3 text-xs"
          >
            <div className="flex justify-between items-center">
              <span className="font-medium text-ink-2">Aturan #{idx + 1}</span>
              <button
                type="button"
                onClick={() => handleDeleteRule(rule.id)}
                disabled={disabled}
                className="text-danger hover:underline disabled:opacity-50"
              >
                Hapus
              </button>
            </div>

            {/* Target Field */}
            <div>
              <label className="mb-1 block text-ink-2">
                Target Field (Path / ID):
              </label>
              <select
                value={rule.targetFieldId}
                disabled={disabled}
                onChange={(e) =>
                  handleUpdateRule(rule.id, { targetFieldId: e.target.value })
                }
                className="w-full rounded-md border border-line bg-surface px-2 py-1.5 text-ink outline-none focus:border-accent"
              >
                <option value="">-- Pilih Target --</option>
                {allFields.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nama} ({f.id})
                  </option>
                ))}
              </select>
            </div>

            {/* Sumber Data */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-ink-2">Sumber Data:</label>
                <select
                  value={rule.sumber}
                  disabled={disabled}
                  onChange={(e) =>
                    handleUpdateRule(rule.id, {
                      sumber: e.target.value as SumberAutofill,
                    })
                  }
                  className="w-full rounded-md border border-line bg-surface px-2 py-1.5 text-ink outline-none focus:border-accent"
                >
                  <option value="warga">Warga</option>
                  <option value="anggota">Anggota (Group)</option>
                  <option value="riwayat">Riwayat</option>
                </select>
              </div>

              {/* Kolom */}
              <div>
                <label className="mb-1 block text-ink-2">Kolom Sumber:</label>
                {rule.sumber === 'warga' ? (
                  <select
                    value={rule.kolom}
                    disabled={disabled}
                    onChange={(e) =>
                      handleUpdateRule(rule.id, { kolom: e.target.value })
                    }
                    className="w-full rounded-md border border-line bg-surface px-2 py-1.5 text-ink outline-none focus:border-accent"
                  >
                    {KOLOM_WARGA.map((kw) => (
                      <option key={kw.value} value={kw.value}>
                        {kw.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={rule.kolom}
                    disabled={disabled}
                    placeholder="mis: nik, nama"
                    onChange={(e) =>
                      handleUpdateRule(rule.id, { kolom: e.target.value })
                    }
                    className="w-full rounded-md border border-line bg-surface px-2 py-1.5 text-ink outline-none focus:border-accent"
                  />
                )}
              </div>
            </div>

            {/* Transform & Mode */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-ink-2">Transform:</label>
                <select
                  value={rule.transform}
                  disabled={disabled}
                  onChange={(e) =>
                    handleUpdateRule(rule.id, {
                      transform: e.target.value as TransformAutofill,
                    })
                  }
                  className="w-full rounded-md border border-line bg-surface px-2 py-1.5 text-ink outline-none focus:border-accent"
                >
                  <option value="teks">Teks</option>
                  <option value="nik">NIK (16 Digit)</option>
                  <option value="tanggal">Tanggal</option>
                  <option value="opsi">Opsi Select</option>
                  <option value="angka">Angka</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-ink-2">Mode Overwrite:</label>
                <select
                  value={rule.mode}
                  disabled={disabled}
                  onChange={(e) =>
                    handleUpdateRule(rule.id, {
                      mode: e.target.value as ModeAutofill,
                    })
                  }
                  className="w-full rounded-md border border-line bg-surface px-2 py-1.5 text-ink outline-none focus:border-accent"
                >
                  <option value="isi_kosong">Isi Hanya Jika Kosong</option>
                  <option value="timpa">Selalu Timpa</option>
                </select>
              </div>
            </div>
          </div>
        ))
      )}
      {catatan ? (
        <p className="rounded-md border border-line bg-surface-2 p-2 text-[11px] text-muted">
          {catatan}
        </p>
      ) : null}
      <p className="text-[11px] text-muted">
        Aturan disimpan saat form di-build.
      </p>
    </div>
  )
}
