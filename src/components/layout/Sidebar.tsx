import { Link } from '@tanstack/react-router'
import {
  ExpandMore,
  Assignment,
  AssignmentOutlined,
  Logout,
  LogoutOutlined,
} from '@mui/icons-material'
import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { APP_BRAND } from '@/lib/constants'
import { navItemsForUser, setDynamicFormChildren } from '@/lib/nav/nav'
import type { NavItem } from '@/lib/nav/nav'
import { useAuth } from '@/providers/auth'
import { cn } from '@/lib/utils'
import { getNavForms, onNavFormsChange } from '@/lib/nav/nav-forms-cache'
import type { BarisFormulirTerisi } from '@/lib/server/survey/form-runtime.server'
import brandIcon from '@/assets/brandIcon.png'

export interface SidebarProps {
  collapsed?: boolean
  onToggleCollapsed?: () => void
}

/**
 * Mendeteksi dark mode berdasarkan class pada elemen <html>.
 */
function useIsDarkMode() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return false

    return document.documentElement.classList.contains('dark')
  })

  useEffect(() => {
    const checkDark = () => {
      setIsDark(document.documentElement.classList.contains('dark'))
    }

    checkDark()

    const observer = new MutationObserver(checkDark)

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme'],
    })

    return () => observer.disconnect()
  }, [])

  return isDark
}

/**
 * Standar layout navigasi.
 *
 * Item utama:
 * - Tinggi minimum 40px.
 * - Ikon dan teks berada dalam satu flex row.
 *
 * Item anak:
 * - Tinggi minimum 36px.
 * - Menggunakan standar ikon dan tipografi yang sama.
 */
const LINK_KELAS =
  'flex min-h-10 items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200 ease-in-out hover:bg-surface-2'

const LINK_KELAS_TERLIPAT = 'justify-center gap-0 px-0'

const AKTIF_INDUK =
  'border border-accent-border bg-accent-light font-semibold'

const LINK_ANAK =
  'flex min-h-9 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-surface-2'

const AKTIF_ANAK = 'bg-accent-light text-accent font-semibold'

/**
 * Standar tipografi seluruh label navigasi.
 *
 * Ukuran font 14px dengan line-height 20px.
 * Tinggi line box disamakan dengan kotak ikon.
 */
const NAV_LABEL_KELAS =
  'block min-w-0 truncate text-sm leading-5 font-medium'

/**
 * Wrapper ikon navigasi.
 *
 * Semua ikon mendapatkan area yang sama, yaitu 20x20px.
 * SVG ditempatkan di tengah area tersebut dengan ukuran 18px.
 *
 * Wrapper ini menormalkan geometri layout tanpa mengubah
 * bentuk asli ikon Material UI.
 */
function SidebarIcon({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex h-5 w-5 shrink-0 items-center justify-center',
        className,
      )}
    >
      {children}
    </span>
  )
}

/**
 * Komponen ikon Material UI dengan ukuran standar.
 */
function SidebarSvgIcon({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <SidebarIcon className={className}>
      {children}
    </SidebarIcon>
  )
}

/**
 * Kepala dropdown:
 * tombol selebar container, ikon, label, dan chevron opsional.
 */
function DropdownTrigger({
  label,
  isOpen,
  onToggle,
  icon,
  showChevron,
}: {
  label: string
  isOpen: boolean
  onToggle: () => void
  icon: ReactNode
  showChevron?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={showChevron ? isOpen : undefined}
      className={cn(LINK_KELAS, 'w-full gap-2.5')}
    >
      <SidebarIcon>{icon}</SidebarIcon>

      <span
        className={cn(
          NAV_LABEL_KELAS,
          'text-ink-2',
          showChevron && 'flex-1',
        )}
      >
        {label}
      </span>

      {showChevron && (
        <SidebarSvgIcon>
          <ExpandMore
            sx={{
              fontSize: 18,
              display: 'block',
            }}
            className={cn(
              'text-muted transition-transform duration-200',
              isOpen && 'rotate-180',
            )}
          />
        </SidebarSvgIcon>
      )}
    </button>
  )
}

/**
 * Daftar item di dalam dropdown.
 */
function DropdownDaftar({
  children,
}: {
  children: ReactNode
}) {
  return (
    <ul
      className="mt-1 ml-6 space-y-1 animate-slide-down"
      role="menu"
    >
      {children}
    </ul>
  )
}

/**
 * Link navigasi biasa.
 */
function NavItemLink({
  item,
  collapsed,
  isDark,
}: {
  item: NavItem
  collapsed: boolean
  isDark: boolean
}) {
  const IconComponent = isDark
    ? (item.IconFilled ?? item.Icon)
    : item.Icon

  return (
    <Link
      to={item.to}
      activeOptions={{ exact: item.to === '/' }}
      className={cn(
        LINK_KELAS,
        collapsed ? LINK_KELAS_TERLIPAT : 'gap-2.5',
      )}
      activeProps={{
        className: AKTIF_INDUK,
      }}
    >
      <SidebarSvgIcon>
        <IconComponent
          sx={{
            fontSize: 18,
            display: 'block',
          }}
        />
      </SidebarSvgIcon>

      <span
        className={cn(
          NAV_LABEL_KELAS,
          'text-ink-2 transition-opacity duration-200',
          collapsed ? 'w-0 opacity-0' : 'opacity-100',
        )}
      >
        {item.label}
      </span>
    </Link>
  )
}

/**
 * Navigasi dengan dropdown.
 */
function NavItemDropdown({
  item,
  collapsed,
  openDropdown,
  setOpenDropdown,
  isDark,
}: {
  item: NavItem
  collapsed: boolean
  openDropdown: string | null
  setOpenDropdown: (key: string | null) => void
  isDark: boolean
}) {
  const IconComponent = isDark
    ? (item.IconFilled ?? item.Icon)
    : item.Icon

  const isOpen = openDropdown === item.to
  const dropdownKey = item.to ?? item.label

  /**
   * Pada mode collapsed, dropdown diarahkan langsung ke halaman induk.
   */
  if (collapsed) {
    return (
      <Link
        to={item.to}
        activeOptions={{ exact: item.to === '/' }}
        className={cn(LINK_KELAS, LINK_KELAS_TERLIPAT)}
        activeProps={{
          className: AKTIF_INDUK,
        }}
        aria-label={item.label}
        title={item.label}
      >
        <SidebarSvgIcon>
          <IconComponent
            sx={{
              fontSize: 18,
              display: 'block',
            }}
          />
        </SidebarSvgIcon>
      </Link>
    )
  }

  return (
    <div>
      <DropdownTrigger
        label={item.label}
        isOpen={isOpen}
        onToggle={() => {
          setOpenDropdown(isOpen ? null : dropdownKey)
        }}
        showChevron
        icon={
          <IconComponent
            sx={{
              fontSize: 18,
              display: 'block',
            }}
          />
        }
      />

      {isOpen && (
        <DropdownDaftar>
          {(item.children ?? []).map((child) => {
            const ChildIcon = isDark
              ? (child.IconFilled ?? child.Icon)
              : child.Icon

            return (
              <li key={child.to} role="none">
                <Link
                  to={child.to}
                  activeOptions={{
                    exact: child.to === '/',
                  }}
                  className={LINK_ANAK}
                  activeProps={{
                    className: AKTIF_ANAK,
                  }}
                >
                  <SidebarSvgIcon>
                    <ChildIcon
                      sx={{
                        fontSize: 18,
                        display: 'block',
                      }}
                    />
                  </SidebarSvgIcon>

                  <span
                    className={cn(
                      NAV_LABEL_KELAS,
                      'text-ink-2',
                    )}
                  >
                    {child.label}
                  </span>
                </Link>
              </li>
            )
          })}
        </DropdownDaftar>
      )}
    </div>
  )
}

/**
 * Dropdown formulir dinamis.
 */
function FormulirDropdownTrigger({
  collapsed,
  openDropdown,
  setOpenDropdown,
  forms,
  isDark,
}: {
  collapsed: boolean
  openDropdown: string | null
  setOpenDropdown: (key: string | null) => void
  forms: BarisFormulirTerisi[]
  isDark: boolean
}) {
  const isOpen = openDropdown === 'formulir'
  const dropdownKey = 'formulir'

  const FormIcon = isDark
    ? Assignment
    : AssignmentOutlined

  /**
   * Pada mode collapsed, ikon mengarah langsung ke halaman formulir.
   */
  if (collapsed) {
    return (
      <Link
        to="/form"
        search={{ jenis: '' }}
        className={cn(LINK_KELAS, LINK_KELAS_TERLIPAT)}
        aria-label="Formulir"
        title="Formulir"
      >
        <SidebarSvgIcon>
          <FormIcon
            sx={{
              fontSize: 18,
              display: 'block',
            }}
          />
        </SidebarSvgIcon>
      </Link>
    )
  }

  return (
    <div>
      <DropdownTrigger
        label="Formulir"
        isOpen={isOpen}
        onToggle={() => {
          setOpenDropdown(isOpen ? null : dropdownKey)
        }}
        icon={
          <FormIcon
            sx={{
              fontSize: 18,
              display: 'block',
            }}
            className="text-accent"
          />
        }
      />

      {isOpen && (
        <DropdownDaftar>
          {forms.length === 0 ? (
            <li role="none">
              <span
                className={cn(
                  NAV_LABEL_KELAS,
                  'px-3 py-2 text-muted',
                )}
              >
                Belum ada form kustom
              </span>
            </li>
          ) : (
            forms.map((form) => (
              <li key={form.formVersionId} role="none">
                <Link
                  to="/isi/$formVersionId"
                  params={{
                    formVersionId: form.formVersionId,
                  }}
                  className={LINK_ANAK}
                  activeProps={{
                    className: AKTIF_ANAK,
                  }}
                >
                  <span
                    className={cn(
                      NAV_LABEL_KELAS,
                      'text-ink-2',
                    )}
                  >
                    {form.nama}
                  </span>
                </Link>
              </li>
            ))
          )}
        </DropdownDaftar>
      )}
    </div>
  )
}

/**
 * Sidebar utama aplikasi.
 */
export function Sidebar({
  collapsed = false,
  onToggleCollapsed,
}: SidebarProps) {
  const { logout } = useAuth()

  const items = navItemsForUser()
  const isDark = useIsDarkMode()

  const [openDropdown, setOpenDropdown] = useState<string | null>(
    null,
  )

  const [navForms, setNavForms] = useState<BarisFormulirTerisi[]>(
    [],
  )

  const [loadingForms, setLoadingForms] = useState(true)

  const LogoutIconComponent = isDark
    ? Logout
    : LogoutOutlined

  const DynamicAssignmentIcon = isDark
    ? Assignment
    : AssignmentOutlined

  /**
   * Memuat formulir dinamis dan mendaftarkan item navigasinya.
   */
  const loadForms = useCallback(() => {
    let cancelled = false

    getNavForms().then((data) => {
      if (cancelled) return

      setNavForms(data)
      setLoadingForms(false)

      setDynamicFormChildren(
        data.map((form) => ({
          label: form.nama,
          to: `/isi/${form.formVersionId}`,
          Icon: DynamicAssignmentIcon,
          IconFilled: Assignment,
        })),
      )
    })

    return () => {
      cancelled = true
    }
  }, [DynamicAssignmentIcon])

  useEffect(() => {
    const cleanup = loadForms()

    const unsubscribe = onNavFormsChange(() => {
      loadForms()
    })

    return () => {
      cleanup()
      unsubscribe()
    }
  }, [loadForms])

  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-screen flex-none flex-col overflow-hidden border-r border-line bg-surface-warm transition-[width] duration-300 ease-in-out md:flex print:hidden',
        collapsed ? 'w-16' : 'w-52.5',
      )}
    >
      {/* Brand */}
      <button
        type="button"
        onClick={onToggleCollapsed}
        aria-label={
          collapsed ? 'Perluas sidebar' : 'Lipat sidebar'
        }
        aria-expanded={!collapsed}
        className={cn(
          'm-3 flex shrink-0 items-center rounded-lg bg-brand transition-colors hover:opacity-90',
          collapsed ? 'justify-center' : 'justify-start',
        )}
      >
        <div
          className={cn(
            'my-2 mx-3 flex shrink-0 items-center transition-[gap] duration-300',
            collapsed ? 'gap-0' : 'gap-2.5',
          )}
        >
          <img
            src={brandIcon}
            alt="Logo Puskesmas"
            className="block h-7 w-auto shrink-0 object-contain"
          />

          <div
            className={cn(
              'overflow-hidden whitespace-nowrap text-white font-extrabold leading-tight transition-all duration-200 ease-in-out',
              collapsed
                ? 'w-0 opacity-0'
                : 'w-auto opacity-100',
            )}
          >
            <h1 className="text-[0.65rem]">
              {APP_BRAND.name}
            </h1>

            <p className="text-left text-[0.6rem]">
              {APP_BRAND.region}
            </p>
          </div>
        </div>
      </button>

      {/* Navigasi utama */}
      <nav
        className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 pb-4 pt-4"
        aria-label="Navigasi utama"
      >
        {items.map((item) => {
          if (item.isDropdownTrigger) {
            if (loadingForms) return null

            return (
              <FormulirDropdownTrigger
                key="formulir"
                collapsed={collapsed}
                openDropdown={openDropdown}
                setOpenDropdown={setOpenDropdown}
                forms={navForms}
                isDark={isDark}
              />
            )
          }

          if (item.children && item.children.length > 0) {
            return (
              <NavItemDropdown
                key={item.to ?? item.label}
                item={item}
                collapsed={collapsed}
                openDropdown={openDropdown}
                setOpenDropdown={setOpenDropdown}
                isDark={isDark}
              />
            )
          }

          return (
            <NavItemLink
              key={item.to}
              item={item}
              collapsed={collapsed}
              isDark={isDark}
            />
          )
        })}
      </nav>

      {/* Logout */}
      <div className="shrink-0 border-t border-line p-3">
        <button
          type="button"
          onClick={() => void logout()}
          aria-label="Keluar"
          title={collapsed ? 'Keluar' : undefined}
          className={cn(
            'flex min-h-10 w-full items-center rounded-lg py-2.5 text-sm font-medium text-danger transition-colors hover:bg-danger/10',
            collapsed
              ? 'justify-center'
              : 'gap-2.5 px-3',
          )}
        >
          <SidebarSvgIcon>
            <LogoutIconComponent
              sx={{
                fontSize: 18,
                display: 'block',
              }}
            />
          </SidebarSvgIcon>

          <span
            className={cn(
              NAV_LABEL_KELAS,
              'text-danger transition-opacity duration-200',
              collapsed
                ? 'sr-only'
                : 'opacity-100',
            )}
          >
            Keluar
          </span>
        </button>
      </div>
    </aside>
  )
}