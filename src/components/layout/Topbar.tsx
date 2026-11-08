import { useEffect, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { ActionIcon, Button, Drawer, Group, Modal, Text } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { Menu, FileText, Settings, LogOut, HelpCircle } from 'lucide-react'
import { NotifikasiBell } from '@/components/notifikasi/NotifikasiBell'
import { NotifikasiToast } from '@/components/notifikasi/NotifikasiToast'
import { PushOtomatis } from '@/components/notifikasi/PushOtomatis'
import ThemeToggle from '@/components/ui/ThemeToggle'
import { getNavForms, onNavFormsChange } from '@/lib/nav/nav-forms-cache'
import type { BarisFormulirTerisi } from '@/lib/server/survey/form-runtime.server'
import { useAuth } from '@/providers/auth'
import { useTour } from '@/providers/tour'

export function Topbar() {
  const [drawerOpened, { open: openDrawer, close: closeDrawer }] =
    useDisclosure(false)
  const [logoutOpened, { open: openLogout, close: closeLogout }] =
    useDisclosure(false)

  const { logout } = useAuth()
  const { mulaiTour, tersedia: adaTour } = useTour()
  const navigate = useNavigate()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [navForms, setNavForms] = useState<BarisFormulirTerisi[]>([])
  const [loadingForms, setLoadingForms] = useState(true)
  const [formsError, setFormsError] = useState(false)

  useEffect(() => {
    let active = true

    const loadForms = () => {
      void getNavForms()
        .then((forms) => {
          if (!active) return
          setNavForms(forms)
          setFormsError(false)
          setLoadingForms(false)
        })
        .catch(() => {
          if (!active) return
          setNavForms([])
          setFormsError(true)
          setLoadingForms(false)
        })
    }

    loadForms()
    const unsubscribe = onNavFormsChange(loadForms)

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const handleLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)

    try {
      await logout()
      closeLogout()
      closeDrawer()
      await navigate({ to: '/pin', replace: true })
    } catch (error) {
      console.error('Gagal logout:', error)
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <>
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-surface/95 px-7 py-3.5 backdrop-blur max-md:px-3.5 max-md:py-2.5 print:hidden">
        {/* Kiri (Mobile Only): Tombol Hamburger Menu */}
        <div className="flex items-center gap-2 md:hidden">
          <button
            type="button"
            onClick={openDrawer}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-surface-2 active:scale-95"
            aria-label="Buka menu navigasi"
          >
            <Menu size={18} strokeWidth={2} />
          </button>
        </div>

        {/* Kanan: Panduan, Notifikasi & Theme Toggle */}
        <div className="ml-auto flex items-center gap-3 max-md:gap-2">
          {adaTour ? (
            <ActionIcon
              type="button"
              variant="light"
              radius="xl"
              size="lg"
              color="var(--lagoon-deep)"
              onClick={mulaiTour}
              aria-label="Mulai panduan halaman ini"
              title="Panduan halaman ini"
              className="hover:text-accent!"
            >
              <HelpCircle size={20} />
            </ActionIcon>
          ) : null}
          <PushOtomatis />
          <NotifikasiBell />
          <NotifikasiToast />
          <ThemeToggle />
        </div>
      </header>

      {/* Slide-over Drawer Menu (Khusus Mobile) */}
      <Drawer
        opened={drawerOpened}
        onClose={closeDrawer}
        title="Menu Aplikasi"
        size="280px"
        padding="md"
        className="md:hidden"
        styles={{
          content: {
            backgroundColor: 'var(--color-surface)',
            color: 'var(--color-ink)',
          },
          header: {
            backgroundColor: 'var(--color-surface)',
            color: 'var(--color-ink)',
            fontWeight: 'bolder',
            borderBottom: '1px solid var(--color-line)',
          },
        }}
      >
        <div className="flex h-[calc(100vh-80px)] flex-col justify-between pt-2">
          {/* Content Drawer */}
          <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
            <span className="px-2 text-[11px] font-bold uppercase tracking-wider text-muted">
              Formulir
            </span>

            {loadingForms ? (
              <span className="px-2.5 py-2 text-xs text-muted">
                Memuat formulir…
              </span>
            ) : formsError ? (
              <span className="px-2.5 py-2 text-xs text-danger">
                Daftar formulir tidak bisa dimuat.
              </span>
            ) : navForms.length > 0 ? (
              navForms.map((form) => (
                <Link
                  key={form.formVersionId}
                  to="/isi/$formVersionId"
                  params={{ formVersionId: form.formVersionId }}
                  onClick={closeDrawer}
                  className="flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-xs font-medium text-ink-2 hover:bg-surface-2 hover:text-ink"
                >
                  <FileText size={16} />
                  <span>{form.nama}</span>
                </Link>
              ))
            ) : (
              <span className="px-2.5 py-2 text-xs text-muted">
                Belum ada formulir yang diterbitkan.
              </span>
            )}

            <hr className="my-3 border-line" />

            <span className="px-2 text-[11px] font-bold uppercase tracking-wider text-muted">
              Pengaturan
            </span>

            <Link
              to="/kelola"
              onClick={closeDrawer}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-xs font-medium text-ink-2 hover:bg-surface-2 hover:text-ink"
            >
              <Settings size={16} />
              <span>Kelola Sistem</span>
            </Link>
          </div>

          {/* Footer Drawer (Aksi Keluar dengan Modal Mantine) */}
          <div className="border-t border-line pt-3">
            <button
              type="button"
              onClick={openLogout}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-sm! font-semibold text-danger hover:bg-danger/10"
            >
              <LogOut size={18} />
              <span className="mt-1">Keluar</span>
            </button>
          </div>
        </div>
      </Drawer>

      {/* Modal Konfirmasi Logout (Mantine) */}
      <Modal
        opened={logoutOpened}
        onClose={closeLogout}
        title="Konfirmasi Logout"
        centered
        size="sm"
        closeOnClickOutside={!isLoggingOut}
        closeOnEscape={!isLoggingOut}
        styles={{
          content: {
            backgroundColor: 'var(--color-surface)',
            color: 'var(--color-ink)',
          },
          header: {
            backgroundColor: 'var(--color-surface)',
            color: 'var(--color-ink)',
            fontWeight: 'bolder',
          },
        }}
      >
        <Text size="sm" c="dimmed">
          Apakah kamu yakin ingin keluar dari aplikasi?
        </Text>

        <Group justify="flex-end" mt="lg">
          <Button
            variant="default"
            onClick={closeLogout}
            disabled={isLoggingOut}
          >
            Batal
          </Button>

          <Button
            color="red"
            onClick={() => void handleLogout()}
            loading={isLoggingOut}
          >
            Ya, Keluar
          </Button>
        </Group>
      </Modal>
    </>
  )
}
