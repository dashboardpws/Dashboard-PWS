import { useMemo } from 'react'
import { Button } from '@/components/ui/Button'
import { Input, Textarea, Select, Checkbox } from '@/components/ui'
import { StatusBadge } from '@/components/ui/StatusBadge'
import {
  X,
  Settings,
  FolderOpen,
  AlertTriangle,
  Database,
  Lightbulb,
} from 'lucide-react'
import type {
  DraftField,
  DraftSection,
  DraftOpsi,
  TipeFieldEditor,
  SelectedItem,
} from './types'
import { TIPE_FIELD_LABELS, TIPE_BUTUH_OPSI, SEMUA_TIPE_FIELD } from './types'
import {
  SUMBER_SUGGEST,
  cariSumber,
  nilaiEnum,
  sumberOpsiPerKelompok,
  tipeBolehPakaiSumber,
  SUMBER_CARI_WARGA,
} from '@/lib/service/form-builder/sumber-opsi'
import type { KunciEditor } from '@/lib/form-builder/kode-bawaan'
import type {
  RuleAutofill,
  RuleVisibilitas,
} from '@/lib/form-builder/engine/types'
import { PropertyPanelAutofill } from '@/components/kunjungan-rumah/PropertyPanelAutofill'
import { PropertyPanelVisibilitas } from '@/components/kunjungan-rumah/PropertyPanelVisibilitas'

interface Props {
  selectedItem: SelectedItem
  onClose: () => void
  document: { sections: DraftSection[]; fields: DraftField[] } | null
  /**
   * Bagian editor yang form ini larang, dari `aturanForm(forms.kode)`.
   *
   * Diteruskan sebagai prop supaya panel ini tidak memanggil registry sendiri:
   * pemanggil sudah menyelesaikannya sekali untuk seluruh editor.
   */
  kunci: KunciEditor
  updateSection: (clientId: string, patch: Partial<DraftSection>) => void
  deleteSection: (clientId: string) => void
  updateField: (clientId: string, patch: Partial<DraftField>) => void
  deleteField: (clientId: string) => void
  addOpsi: (fieldClientId: string) => void
  updateOpsi: (
    fieldClientId: string,
    opsiClientId: string,
    patch: Partial<DraftOpsi>,
  ) => void
  deleteOpsi: (fieldClientId: string, opsiClientId: string) => void
  setSumberOpsi: (
    fieldClientId: string,
    type: string | null,
    key: string | null,
  ) => void
  rulesAutofill: RuleAutofill[]
  rulesVisibilitas: RuleVisibilitas[]
  setRulesAutofill: (rules: RuleAutofill[]) => void
  setRulesVisibilitas: (rules: RuleVisibilitas[]) => void
  disabled: boolean
}

export function SettingsPanel({
  selectedItem,
  onClose,
  document,
  kunci,
  updateSection,
  deleteSection,
  updateField,
  deleteField,
  addOpsi,
  updateOpsi,
  deleteOpsi,
  setSumberOpsi,
  rulesAutofill,
  rulesVisibilitas,
  setRulesAutofill,
  setRulesVisibilitas,
  disabled,
}: Props) {
  const fieldsWithSection = (document?.fields ?? []).map((field) => ({
    field,
    sectionName: document?.sections.find(
      (section) => section.clientId === field.sectionClientId,
    )?.nama,
  }))
  const ruleFields = fieldsWithSection
    .filter(
      ({ field, sectionName }) =>
        !kunci.strukturSection ||
        (field.tipe !== 'group' &&
          (sectionName === 'keluargaInfo' || sectionName === 'sanitasi')),
    )
    .map(({ field }) => ({
      id: field.clientId,
      nama: field.label || field.nama || 'Field tanpa nama',
    }))
  const catatanDukunganRule = kunci.strukturSection
    ? 'Form KR saat ini menjalankan rule untuk field tunggal Data Keluarga dan Sanitasi. Field anggota dan sasaran yang berulang belum mendukung rule per baris.'
    : undefined
  if (!selectedItem) {
    return (
      <div className="h-full min-h-0 w-[320px] shrink-0 overflow-y-auto border-l border-line bg-surface-2 p-3 max-md:w-full max-md:border-l-0">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-ink">Pengaturan</h3>
          <Button size="sm" variant="ghost" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="text-center text-muted py-8">
          <Settings className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Pilih section atau field untuk mengedit</p>
        </div>
      </div>
    )
  }

  if (selectedItem.type === 'section') {
    return (
      <SectionSettings
        sectionClientId={selectedItem.clientId}
        onClose={onClose}
        document={document}
        kunci={kunci}
        updateSection={updateSection}
        deleteSection={deleteSection}
        allFields={ruleFields}
        rulesVisibilitas={rulesVisibilitas}
        setRulesVisibilitas={setRulesVisibilitas}
        disabled={disabled}
        canAddRule={
          !kunci.strukturSection ||
          ['keluargaInfo', 'sanitasi'].includes(
            document?.sections.find((s) => s.clientId === selectedItem.clientId)
              ?.nama ?? '',
          )
        }
        catatanDukunganRule={catatanDukunganRule}
      />
    )
  }

  return (
    <FieldSettings
      fieldClientId={selectedItem.clientId}
      onClose={onClose}
      document={document}
      kunci={kunci}
      updateField={updateField}
      deleteField={deleteField}
      addOpsi={addOpsi}
      updateOpsi={updateOpsi}
      deleteOpsi={deleteOpsi}
      setSumberOpsi={setSumberOpsi}
      allFields={ruleFields}
      rulesAutofill={rulesAutofill}
      rulesVisibilitas={rulesVisibilitas}
      setRulesAutofill={setRulesAutofill}
      setRulesVisibilitas={setRulesVisibilitas}
      disabled={disabled}
      canAddRule={
        !kunci.strukturSection ||
        ['keluargaInfo', 'sanitasi'].includes(
          fieldsWithSection.find(
            ({ field }) => field.clientId === selectedItem.clientId,
          )?.sectionName ?? '',
        )
      }
      catatanDukunganRule={catatanDukunganRule}
    />
  )
}

function SectionSettings({
  sectionClientId,
  onClose,
  document,
  kunci,
  updateSection,
  deleteSection,
  allFields,
  rulesVisibilitas,
  setRulesVisibilitas,
  disabled,
  canAddRule,
  catatanDukunganRule,
}: {
  sectionClientId: string
  onClose: () => void
  document: { sections: DraftSection[]; fields: DraftField[] } | null
  kunci: KunciEditor
  updateSection: (clientId: string, patch: Partial<DraftSection>) => void
  deleteSection: (clientId: string) => void
  allFields: { id: string; nama: string }[]
  rulesVisibilitas: RuleVisibilitas[]
  setRulesVisibilitas: (rules: RuleVisibilitas[]) => void
  disabled: boolean
  canAddRule: boolean
  catatanDukunganRule?: string
}) {
  const section = document?.sections.find((s) => s.clientId === sectionClientId)
  if (!section) return null

  return (
    <div className="h-full min-h-0 w-[320px] shrink-0 overflow-y-auto border-l border-line bg-surface-2 p-3 max-md:w-full max-md:border-l-0">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-ink flex items-center gap-1">
          <FolderOpen className="w-4 h-4" /> Section
        </h3>
        <Button size="sm" variant="ghost" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid gap-3">
        <div>
          <label className="block text-xs font-medium text-ink-2 mb-1">
            Nama section
          </label>
          <Input
            value={section.nama}
            onChange={(e) =>
              updateSection(sectionClientId, { nama: e.target.value })
            }
            placeholder="Nama section"
            disabled={kunci.namaSection}
          />
          {kunci.namaSection ? (
            <p className="text-[10px] text-muted mt-0.5">
              Nama section form ini dipetakan ke form kader secara langsung,
              jadi tidak bisa diubah.
            </p>
          ) : null}
        </div>

        <div>
          <label className="block text-xs font-medium text-ink-2 mb-1">
            Deskripsi (opsional)
          </label>
          <Textarea
            value={section.deskripsi ?? ''}
            onChange={(e) =>
              updateSection(sectionClientId, { deskripsi: e.target.value })
            }
            placeholder="Deskripsi section"
            rows={2}
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-ink-2">
          <Checkbox
            checked={section.aktif}
            onChange={(e) =>
              updateSection(sectionClientId, { aktif: e.target.checked })
            }
          />
          Aktif (tampil di form)
        </label>

        {kunci.strukturSection ? null : (
          <div className="pt-2 border-t border-line">
            <Button
              size="sm"
              variant="danger"
              className="w-full"
              onClick={() => {
                deleteSection(sectionClientId)
                onClose()
              }}
            >
              Hapus Section
            </Button>
          </div>
        )}
        <PropertyPanelVisibilitas
          targetType="section"
          targetId={sectionClientId}
          allFields={allFields}
          rules={rulesVisibilitas}
          onChange={setRulesVisibilitas}
          disabled={disabled}
          canAdd={canAddRule}
          catatan={catatanDukunganRule}
        />
      </div>
    </div>
  )
}

function FieldSettings({
  fieldClientId,
  onClose,
  document,
  kunci,
  updateField,
  deleteField,
  addOpsi,
  updateOpsi,
  deleteOpsi,
  setSumberOpsi,
  allFields,
  rulesAutofill,
  rulesVisibilitas,
  setRulesAutofill,
  setRulesVisibilitas,
  disabled,
  canAddRule,
  catatanDukunganRule,
}: {
  fieldClientId: string
  onClose: () => void
  document: { sections: DraftSection[]; fields: DraftField[] } | null
  kunci: KunciEditor
  updateField: (clientId: string, patch: Partial<DraftField>) => void
  deleteField: (clientId: string) => void
  addOpsi: (fieldClientId: string) => void
  updateOpsi: (
    fieldClientId: string,
    opsiClientId: string,
    patch: Partial<DraftOpsi>,
  ) => void
  deleteOpsi: (fieldClientId: string, opsiClientId: string) => void
  setSumberOpsi: (
    fieldClientId: string,
    type: string | null,
    key: string | null,
  ) => void
  allFields: { id: string; nama: string }[]
  rulesAutofill: RuleAutofill[]
  rulesVisibilitas: RuleVisibilitas[]
  setRulesAutofill: (rules: RuleAutofill[]) => void
  setRulesVisibilitas: (rules: RuleVisibilitas[]) => void
  disabled: boolean
  canAddRule: boolean
  catatanDukunganRule?: string
}) {
  const field = document?.fields.find((f) => f.clientId === fieldClientId)
  if (!field) return null

  const needsOptions = TIPE_BUTUH_OPSI.includes(field.tipe)
  const hasOptions = field.opsi.some((o) => o.value.trim() && o.aktif)
  const isSuggest = field.optionSourceType === SUMBER_SUGGEST
  const source = cariSumber(field.optionSourceType, field.optionSourceKey)
  const sumberAktif = isSuggest || source !== null
  /**
   * Tipe yang boleh dipilih form ini. `null` = semua bebas.
   *
   * Field bawaan bisa punya tipe di luar daftar itu — satu-satunya contoh adalah
   * `record_legacy` yang bertipe `group`. Tipe itu tetap ditampilkan supaya
   * petugas tidak melihat select kosong, tapi tidak bisa diganti.
   */
  const tipeTersedia = kunci.tipe
    ? SEMUA_TIPE_FIELD.filter((t) => kunci.tipe!.has(t))
    : SEMUA_TIPE_FIELD
  const tipeDiKunci = kunci.tipe !== null && !kunci.tipe.has(field.tipe)
  const bolehHapusField = !kunci.namaFieldTidakBolehDihapus(field.nama)
  // Sumber yang boleh dipasang ke field ini. `text` hanya boleh memakai daftar
  // saran, jadi daftar opsi lain sengaja tidak ikut ditampilkan.
  const sumberTersedia = useMemo(
    () =>
      kunci.optionSource
        ? []
        : sumberOpsiPerKelompok()
            .map((g) => ({
              ...g,
              daftar: g.daftar.filter((s) =>
                tipeBolehPakaiSumber({
                  tipe: field.tipe,
                  type: s.type,
                  key: s.key,
                }),
              ),
            }))
            .filter((g) => g.daftar.length > 0),
    [field.tipe, kunci.optionSource],
  )
  return (
    <div className="w-95 shrink-0 border-l border-line bg-surface-2 p-3 overflow-y-auto h-full min-h-0">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-ink flex items-center gap-1">
          <Settings className="w-4 h-4" /> Field
        </h3>
        <Button size="sm" variant="ghost" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid gap-3">
        <div>
          <label className="block text-xs font-medium text-ink-2 mb-1">
            Pertanyaan (label)
          </label>
          <Input
            value={field.label}
            onChange={(e) =>
              updateField(fieldClientId, { label: e.target.value })
            }
            placeholder="Contoh: Tekanan darah"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-ink-2 mb-1">
            Kode teknis (nama)
          </label>
          <Input
            value={field.nama}
            onChange={(e) =>
              updateField(fieldClientId, {
                nama: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''),
              })
            }
            placeholder="tekanan_darah"
            disabled={!!field.id}
          />
          {field.id && (
            <p className="text-[10px] text-muted mt-0.5">
              Kode terkunci karena sudah punya jawaban tersimpan
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-ink-2 mb-1">
            Tipe
          </label>
          <Select
            value={field.tipe}
            onChange={(e) => {
              const tipe = e.target.value as TipeFieldEditor
              const patch: Partial<DraftField> = {
                tipe,
                jumlahKolom: tipe === 'group' ? 2 : null,
              }
              if (!TIPE_BUTUH_OPSI.includes(tipe)) patch.opsi = []
              updateField(fieldClientId, patch)
            }}
            disabled={tipeDiKunci}
          >
            {/* Tipe bawaan yang tidak ada di daftar pilihan tetap ikut
                dirender supaya select tidak tampak kosong. */}
            {tipeDiKunci ? (
              <option value={field.tipe}>
                {TIPE_FIELD_LABELS[field.tipe]}
              </option>
            ) : null}
            {tipeTersedia.map((t) => (
              <option key={t} value={t}>
                {TIPE_FIELD_LABELS[t]}
              </option>
            ))}
          </Select>
          {kunci.tipe ? (
            <p className="text-[10px] text-muted mt-0.5">
              Form ini hanya bisa diisi dengan tipe:{' '}
              {[...kunci.tipe].join(', ')}.
            </p>
          ) : null}
        </div>

        {field.tipe === 'group' && (
          <div>
            <label className="block text-xs font-medium text-ink-2 mb-1">
              Jumlah kolom per baris
            </label>
            <Input
              type="number"
              min={1}
              value={field.jumlahKolom ?? 2}
              onChange={(e) =>
                updateField(fieldClientId, {
                  jumlahKolom: Number(e.target.value) || 1,
                })
              }
            />
          </div>
        )}

        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm text-ink-2">
            <Checkbox
              checked={field.wajib}
              onChange={(e) =>
                updateField(fieldClientId, { wajib: e.target.checked })
              }
            />
            Wajib diisi
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-2">
            <Checkbox
              checked={field.aktif}
              onChange={(e) =>
                updateField(fieldClientId, { aktif: e.target.checked })
              }
            />
            Aktif
          </label>
        </div>

        <div>
          <label className="block text-xs font-medium text-ink-2 mb-1">
            Placeholder (opsional)
          </label>
          <Input
            value={field.placeholder ?? ''}
            onChange={(e) =>
              updateField(fieldClientId, { placeholder: e.target.value })
            }
            placeholder="Contoh: 120/80"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-ink-2 mb-1">
            Catatan untuk petugas (opsional)
          </label>
          <Textarea
            value={field.deskripsi ?? ''}
            onChange={(e) =>
              updateField(fieldClientId, { deskripsi: e.target.value })
            }
            placeholder="Petunjuk isi..."
            rows={2}
          />
        </div>

        {(needsOptions || field.tipe === 'text') && (
          <fieldset className="rounded-lg border border-line p-3">
            <legend className="px-1 text-xs font-semibold text-ink-2 flex items-center gap-1">
              Pilihan jawaban{' '}
              {needsOptions &&
                (hasOptions || sumberAktif ? (
                  <StatusBadge variant="done">Siap</StatusBadge>
                ) : (
                  <AlertTriangle className="w-3 h-3 text-warning" />
                ))}
            </legend>

            {sumberTersedia.length > 0 ? (
              <div className="grid gap-1.5">
                <label className="block text-xs font-medium text-ink-2">
                  Sumber pilihan
                </label>
                <Select
                  value={
                    field.optionSourceType
                      ? `${field.optionSourceType}::${field.optionSourceKey ?? ''}`
                      : ''
                  }
                  onChange={(e) => {
                    const nilai = e.target.value
                    if (!nilai) {
                      setSumberOpsi(fieldClientId, null, null)
                      return
                    }
                    const [type = '', ...sisa] = nilai.split('::')
                    setSumberOpsi(fieldClientId, type, sisa.join('::') || null)
                  }}
                >
                  <option value="">Manual (ketik sendiri)</option>
                  {sumberTersedia.map((g) => (
                    <optgroup key={g.kelompok} label={g.kelompok}>
                      {g.daftar.map((s) => (
                        <option
                          key={`${s.type}::${s.key}`}
                          value={`${s.type}::${s.key}`}
                        >
                          {s.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </Select>
                <p className="text-[11px] font-normal text-muted">
                  {isSuggest
                    ? 'Daftar saran muncul sebagai pilihan saat petugas mengetik. Isian tetap bebas, jadi nilai di luar daftar ini tetap diterima.'
                    : source
                      ? source.perluServer
                        ? `Daftar jawaban diambil dari database (${source.label}) saat form diisi, jadi ikut berubah sendiri mengikuti datanya.`
                        : `Daftar jawaban diambil dari data warga yang sudah ada (${source.label}).`
                      : 'Pilih sumber supaya pilihan jawabannya diambil dari data yang sudah ada, tanpa mengetik ulang.'}
                </p>
                {source && !source.perluServer ? (
                  <div className="rounded-lg border border-line bg-surface px-2.5 py-2">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                      {nilaiEnum(source.key)?.length ?? 0} nilai
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(nilaiEnum(source.key) ?? []).map((v) => (
                        <span
                          key={v}
                          className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-ink-2"
                        >
                          {v}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {!sumberAktif ? (
              <>
                {field.opsi.length === 0 ? (
                  <p className="mt-2 text-sm text-muted text-center py-2">
                    Belum ada opsi
                  </p>
                ) : (
                  <div className="grid gap-2 mt-2">
                    {field.opsi.map((o) => (
                      <div
                        key={o.clientId}
                        className="grid grid-cols-[1fr_1fr_auto] gap-2"
                      >
                        <Input
                          value={o.value}
                          placeholder="nilai tersimpan"
                          onChange={(e) =>
                            updateOpsi(fieldClientId, o.clientId, {
                              value: e.target.value,
                            })
                          }
                        />
                        <Input
                          value={o.label}
                          placeholder="teks untuk petugas"
                          onChange={(e) =>
                            updateOpsi(fieldClientId, o.clientId, {
                              label: e.target.value,
                            })
                          }
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => deleteOpsi(fieldClientId, o.clientId)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full mt-2"
                  onClick={() => addOpsi(fieldClientId)}
                >
                  + Tambah opsi
                </Button>
              </>
            ) : isSuggest ? (
              <>
                <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-ink-2">
                  <Lightbulb className="w-3.5 h-3.5 text-warning" /> Daftar
                  saran
                </div>
                {field.opsi.length === 0 ? (
                  <p className="mt-1 text-sm text-muted text-center py-2">
                    Belum ada saran. Field tetap bisa diisi bebas.
                  </p>
                ) : (
                  <div className="grid gap-2 mt-1">
                    {field.opsi.map((o) => (
                      <div
                        key={o.clientId}
                        className="grid grid-cols-[1fr_1fr_auto] gap-2"
                      >
                        <Input
                          value={o.value}
                          placeholder="saran"
                          onChange={(e) =>
                            updateOpsi(fieldClientId, o.clientId, {
                              value: e.target.value,
                            })
                          }
                        />
                        <Input
                          value={o.label}
                          placeholder="teks yang muncul"
                          onChange={(e) =>
                            updateOpsi(fieldClientId, o.clientId, {
                              label: e.target.value,
                            })
                          }
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => deleteOpsi(fieldClientId, o.clientId)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full mt-2"
                  onClick={() => addOpsi(fieldClientId)}
                >
                  + Tambah saran
                </Button>
              </>
            ) : (
              <p className="mt-2 flex items-start gap-1.5 text-[11px] font-normal text-muted">
                <Database className="mt-0.5 w-3.5 h-3.5 shrink-0" />
                Opsi manual disembunyikan karena jawaban diambil dari sumber di
                atas. Pilih "Manual" untuk mengetik sendiri.
              </p>
            )}
          </fieldset>
        )}

        {bolehHapusField ? (
          <div className="pt-2 border-t border-line">
            <Button
              size="sm"
              variant="danger"
              className="w-full"
              onClick={() => {
                deleteField(fieldClientId)
                onClose()
              }}
            >
              Hapus Field
            </Button>
          </div>
        ) : (
          <p className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-[11px] text-muted">
            Field ini tidak bisa dihapus karena seluruh data kunjungan rumah
            disimpan di sini.
          </p>
        )}
        {field.optionSourceType === SUMBER_CARI_WARGA ? (
          <PropertyPanelAutofill
            triggerFieldId={fieldClientId}
            allFields={allFields}
            rules={rulesAutofill}
            onChange={setRulesAutofill}
            disabled={disabled}
            canAdd={canAddRule}
            catatan={catatanDukunganRule}
          />
        ) : null}
        <PropertyPanelVisibilitas
          targetType="field"
          targetId={fieldClientId}
          allFields={allFields}
          rules={rulesVisibilitas}
          onChange={setRulesVisibilitas}
          disabled={disabled}
          canAdd={canAddRule}
          catatan={catatanDukunganRule}
        />
      </div>
    </div>
  )
}
