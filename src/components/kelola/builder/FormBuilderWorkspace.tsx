import { useCallback, useEffect, useMemo, useState } from 'react'
import { DragDropProvider, DragOverlay } from '@dnd-kit/react'
import {
  FolderPlus,
  RotateCcw,
  Save,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  FlaskConical,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { PeringatanBox } from '@/components/shared'
import { BlockPalette } from './BlockPalette'
import { KontenDrag } from './KontenDrag'
import { SectionNode } from './SectionNode'
import { SettingsPanel } from './SettingsPanel'
import { BuildOverlay } from './BuildOverlay'
import { PratinjauOverlay } from '@/components/kelola/builder/preview/PratinjauOverlay'
import { SimulasiPreview } from '@/components/kelola/builder/preview/SimulasiPreview'
import { getOrphanFieldIds } from './tree'
import { aturanForm } from '@/lib/form-builder/kode-bawaan'
import type { DraftFormDocument, DraftField } from './types'
import type { DefinisiVersi } from '@/hooks/kelola/use-form-builder'
import type { useFormBuilderDraft } from '@/hooks/kelola/use-form-builder-draft'

interface FormBuilderWorkspaceProps {
  formVersionId: string
  bisaUbah: boolean
  /**
   * `forms.kode` form yang sedang disunting, atau `null` untuk form manual.
   * Menentukan bagian mana dari editor yang dikunci — mis. section dan tipe
   * field form bawaan tidak bisa ditambah atau diubah, karena server akan
   * menolak build-nya (lihat `aturanForm`).
   */
  kodeForm: string | null
  onBack?: () => void
  document: DraftFormDocument | null
  draft: Omit<
    ReturnType<typeof useFormBuilderDraft>,
    'document' | 'loadDocument' | 'clearDocument'
  >
  loadDocument: (definisi: DefinisiVersi) => void
}

export function FormBuilderWorkspace({
  formVersionId,
  bisaUbah,
  kodeForm,
  onBack,
  document,
  draft,
  loadDocument,
}: FormBuilderWorkspaceProps) {
  const {
    flatTree,
    palette,
    saving,
    buildError,
    addSection,
    addField,
    handleDragEnd: dragEnd,
    buildForm,
    setSelectedItem,
    updateSection,
    deleteSection,
    updateField,
    deleteField,
    addOpsi,
    updateOpsi,
    deleteOpsi,
    setSumberOpsi,
    setRulesAutofill,
    setRulesVisibilitas,
    selectedItem,
  } = draft

  const [showBuildOverlay, setShowBuildOverlay] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(true)
  const [previewMode, setPreviewMode] = useState(false)
  const [simulasiMode, setSimulasiMode] = useState(false)

  // Bagian editor yang form bawaan tidak boleh ubah. Penegakan ada di server;
  // yang di sini hanya jangan menawarkan kontrol yang pasti ditolak.
  const kunci = aturanForm(kodeForm).kunciEditor

  // Palette form bawaan hanya menampilkan tipe yang benar-benar bisa dipakai
  // form itu, jadi tidak ada field yang bisa dibuat lalu ditolak saat build.
  const paletteTersedia = useMemo(
    () =>
      kunci.tipe ? palette.filter((p) => kunci.tipe!.has(p.tipe)) : palette,
    [palette, kunci.tipe],
  )

  // Panel pengaturan otomatis terbuka saat ada yang dipilih.
  useEffect(() => {
    if (selectedItem) setSettingsOpen(true)
  }, [selectedItem])

  const orphanFieldCount = useMemo(
    () =>
      document
        ? getOrphanFieldIds(document.sections, document.fields).length
        : 0,
    [document],
  )

  const fieldsByClientId = useMemo(() => {
    const map = new Map<string, DraftField>()
    document?.fields.forEach((f) => map.set(f.clientId, f))
    return map
  }, [document])

  /**
   * Hapus field, kecuali field yang form ini larang.
   *
   * Diteruskan ke `SectionNode` sebagai `undefined` kalau field-nya terkunci,
   * karena `FieldNode` menyembunyikan tombol hapus kalau handler-nya tidak ada.
   * Field penyimpan data kunjungan rumah masuk kelompok ini: menghapusnya
   * membuat seluruh data kunjungan lama tidak bisa dibaca maupun diperbarui.
   */
  const hapusFieldJikaBoleh = useCallback(
    (clientId: string) => {
      const field = fieldsByClientId.get(clientId)
      if (field && kunci.namaFieldTidakBolehDihapus(field.nama)) return
      deleteField(clientId)
    },
    [fieldsByClientId, kunci, deleteField],
  )

  const handleAddField = useCallback(
    (sectionClientId: string) => {
      const newClientId = addField(sectionClientId, {
        nama: '',
        label: '',
        tipe: 'text',
      })
      setSelectedItem({ type: 'field', clientId: newClientId })
    },
    [addField, setSelectedItem],
  )

  const handleAddSection = useCallback(() => {
    addSection()
  }, [addSection])

  const handleBuild = useCallback(async () => {
    setShowBuildOverlay(true)
    const result = await buildForm()
    if (result) {
      const { ambilEditorForm } = await import('@/lib/api/server-fns')
      const fresh = await ambilEditorForm({ data: { formVersionId } })
      loadDocument(fresh)
    }
    setShowBuildOverlay(false)
    return result
  }, [buildForm, formVersionId, loadDocument])
  const handlePreviewMode = useCallback(() => {
    setPreviewMode((v) => {
      if (!v) setSimulasiMode(false)
      return !v
    })
  }, [])

  // Simulasi dan pratinjau tidak boleh tampil bersamaan: keduanya overlay penuh
  // yang menutupi editor, jadi menyalakan satu harus mematikan yang lain.
  const handleSimulasiMode = useCallback(() => {
    setSimulasiMode((v) => {
      if (!v) setPreviewMode(false)
      return !v
    })
  }, [])

  // Pratinjau membaca draft yang sedang diedit, jadi overlay-nya juga ikut
  // berubah setiap edit — tidak perlu Build lebih dulu.
  const handleDragEnd = useCallback(
    (event: Parameters<NonNullable<typeof dragEnd>>[0]) => {
      if (previewMode || simulasiMode) return
      dragEnd(event)
    },
    [previewMode, simulasiMode, dragEnd],
  )

  return (
    <DragDropProvider onDragEnd={handleDragEnd}>
      {/*
        Overlay drag. WAJIB ada: tanpa itu dnd-kit memindahkan DOM node asli ke
        `document.body` selama drag dan mengembalikannya saat selesai. Node itu
        milik React, jadi penghapusan sebuah field tepat setelah dipindahkan antar
        section membuat React dan dnd-kit berebut atas node yang sama — hasilnya
        `Node.removeChild: The node to be removed is not a child of this node`.

        `pointer-events-none` supaya overlay tidak pernah jadi target klik atau
        hover yang menutupi drop zone di bawahnya.
      */}
      <DragOverlay className="pointer-events-none" dropAnimation={null}>
        {(source) => <KontenDrag source={source} document={document} />}
      </DragOverlay>

      <div className="h-[calc(100vh-200px)] min-h-125 flex flex-col">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-2">
            {onBack && (
              <Button size="sm" variant="ghost" onClick={onBack}>
                <RotateCcw className="w-4 h-4" /> Kembali
              </Button>
            )}
            <span className="text-sm font-medium text-ink">Form Builder</span>
          </div>
          <div className="flex items-center gap-2">
            {bisaUbah ? (
              <>
                {kunci.strukturSection ? null : (
                  <Button size="sm" variant="ghost" onClick={handleAddSection}>
                    <FolderPlus className="w-4 h-4" /> Tambah Section
                  </Button>
                )}
                <Button
                  size="sm"
                  variant={previewMode ? 'primary' : 'default'}
                  onClick={handlePreviewMode}
                  aria-pressed={previewMode}
                >
                  <Eye className="w-4 h-4" /> Pratinjau
                </Button>
                <Button
                  size="sm"
                  variant={simulasiMode ? 'primary' : 'default'}
                  onClick={handleSimulasiMode}
                  aria-pressed={simulasiMode}
                  title="Isi form seperti petugas untuk mencoba alurnya. Isian hanya lokal, tidak disimpan."
                >
                  <FlaskConical className="w-4 h-4" /> Simulasi
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={handleBuild}
                  disabled={saving}
                >
                  <Save className="w-4 h-4" />{' '}
                  {saving ? 'Membangun...' : 'Build'}
                </Button>
              </>
            ) : (
              <Button size="sm" variant="ghost" disabled>
                Build (hanya draft)
              </Button>
            )}
          </div>
        </div>

        {buildError && (
          <PeringatanBox className="mb-3" align="center">
            {buildError}
          </PeringatanBox>
        )}

        {orphanFieldCount > 0 && (
          <PeringatanBox className="mb-3" align="center">
            {`${orphanFieldCount} field yatim (section hilang) ditemukan. Pindahkan sebelum Build.`}
          </PeringatanBox>
        )}

        <div className="flex-1 flex min-h-0 overflow-hidden">
          {paletteOpen ? (
            <div className="relative shrink-0 flex">
              <BlockPalette items={paletteTersedia} disabled={!bisaUbah} />
              <button
                type="button"
                onClick={() => setPaletteOpen(false)}
                title="Liput panel Komponen"
                className="absolute top-2 -right-3 z-10 w-6 h-6 flex items-center justify-center rounded-full border border-line bg-surface text-muted hover:text-ink hover:border-accent-border shadow-sm"
              >
                <ChevronsLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              title="Buka panel Komponen"
              className="shrink-0 w-8 flex flex-col items-center gap-2 border-r border-line bg-surface-2 py-3 text-muted hover:text-ink"
            >
              <ChevronsRight className="w-4 h-4" />
              <span
                className="text-[10px] font-semibold uppercase tracking-wide"
                style={{ writingMode: 'vertical-rl' }}
              >
                Komponen
              </span>
            </button>
          )}

          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-3">
              {document ? (
                <>
                  {document.sections.length === 0 ? (
                    <div className="text-center text-muted py-12">
                      <FolderPlus className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">
                        {kunci.strukturSection
                          ? 'Form ini memakai section tetap, jadi section tidak bisa ditambah dari sini.'
                          : 'Belum ada section. Klik "Tambah Section" atau tarik field ke area ini.'}
                      </p>
                    </div>
                  ) : (
                    document.sections.map((section, sectionIdx) => (
                      <SectionNode
                        key={section.clientId}
                        section={section}
                        flatTree={flatTree}
                        index={sectionIdx}
                        disabled={!bisaUbah}
                        isSelected={
                          selectedItem?.type === 'section' &&
                          selectedItem.clientId === section.clientId
                        }
                        fieldsByClientId={fieldsByClientId}
                        onSelect={(clientId) =>
                          setSelectedItem({ type: 'section', clientId })
                        }
                        onSelectField={(clientId) =>
                          setSelectedItem({ type: 'field', clientId })
                        }
                        onDeselectField={() => setSelectedItem(null)}
                        selectedFieldClientId={
                          selectedItem?.type === 'field'
                            ? selectedItem.clientId
                            : null
                        }
                        onAddField={handleAddField}
                        onUpdateSection={updateSection}
                        onDeleteSection={
                          kunci.strukturSection ? undefined : deleteSection
                        }
                        onUpdateField={updateField}
                        onDeleteField={hapusFieldJikaBoleh}
                      />
                    ))
                  )}
                </>
              ) : (
                <div className="text-center text-muted py-12">
                  <p className="text-sm">Memuat form…</p>
                </div>
              )}
            </div>
          </div>

          {settingsOpen ? (
            <div className="relative shrink-0 flex">
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                title="Liput panel Pengaturan"
                className="absolute top-2 -left-3 z-10 w-6 h-6 flex items-center justify-center rounded-full border border-line bg-surface text-muted hover:text-ink hover:border-accent-border shadow-sm"
              >
                <ChevronsRight className="w-3.5 h-3.5" />
              </button>
              <SettingsPanel
                selectedItem={selectedItem}
                onClose={() => setSelectedItem(null)}
                document={document}
                kunci={kunci}
                updateSection={updateSection}
                deleteSection={deleteSection}
                updateField={updateField}
                deleteField={deleteField}
                addOpsi={addOpsi}
                updateOpsi={updateOpsi}
                deleteOpsi={deleteOpsi}
                setSumberOpsi={setSumberOpsi}
                rulesAutofill={document?.rulesAutofill ?? []}
                rulesVisibilitas={document?.rulesVisibilitas ?? []}
                setRulesAutofill={setRulesAutofill}
                setRulesVisibilitas={setRulesVisibilitas}
                disabled={!bisaUbah}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              title="Buka panel Pengaturan"
              className="shrink-0 w-8 flex flex-col items-center gap-2 border-l border-line bg-surface-2 py-3 text-muted hover:text-ink"
            >
              <ChevronsLeft className="w-4 h-4" />
              <span
                className="text-[10px] font-semibold uppercase tracking-wide"
                style={{ writingMode: 'vertical-rl' }}
              >
                Pengaturan
              </span>
            </button>
          )}
        </div>
      </div>

      <BuildOverlay
        isOpen={showBuildOverlay}
        onClose={() => setShowBuildOverlay(false)}
        onBuild={handleBuild}
        saving={saving}
      />

      {/* Pratinjau memang tidak butuh drag-drop, tapi tetap berada di dalam
          `DragDropProvider` karena satu-satunya cara keluar dari sana adalah
          memindahkan seluruh isi editor ke provider terpisah. Tidak berbahaya:
          field pratinjau dirender `readOnly`, jadi tidak ada yang bisa diseret. */}
      <PratinjauOverlay
        isOpen={previewMode}
        document={document}
        onClose={() => setPreviewMode(false)}
      />

      {/* Simulasi tetap di dalam provider dengan alasan yang sama. Bedanya di
          sini field-nya bisa diketik, tapi tetap bukan drop zone, jadi dnd-kit
          tidak pernah melihatnya sebagai sumber drag. */}
      <SimulasiPreview
        isOpen={simulasiMode}
        document={document}
        onClose={() => setSimulasiMode(false)}
      />
    </DragDropProvider>
  )
}
