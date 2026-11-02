import {
  DashboardOutlined,
  Dashboard,
  DescriptionOutlined,
  Description,
  AssignmentTurnedInOutlined,
  AssignmentTurnedIn,
  AssignmentOutlined,
  Assignment,
  ArticleOutlined,
  Article,
  NotificationsOutlined,
  Notifications,
  SettingsOutlined,
  Settings,
} from '@mui/icons-material'
import type { SvgIconProps } from '@mui/material/SvgIcon'

export interface NavItem {
  label: string
  /** Label ringkas untuk nav bawah yang sempit. Falls back ke `label` kalau kosong. */
  shortLabel?: string
  to?: string
  Icon: React.ComponentType<SvgIconProps>
  IconFilled?: React.ComponentType<SvgIconProps>
  children?: NavItem[]
  isDropdownTrigger?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    to: '/',
    Icon: DashboardOutlined,
    IconFilled: Dashboard,
  },
  {
    label: 'Data Sasaran',
    to: '/sasaran',
    Icon: DescriptionOutlined,
    IconFilled: Description,
  },
  {
    label: 'Kunjungan Rumah',
    to: '/kunjungan-rumah',
    Icon: AssignmentTurnedInOutlined,
    IconFilled: AssignmentTurnedIn,
  },
  {
    label: 'Formulir',
    Icon: AssignmentOutlined,
    IconFilled: Assignment,
    isDropdownTrigger: true,
    children: [],
  },
  {
    label: 'Laporan',
    to: '/laporan',
    Icon: ArticleOutlined,
    IconFilled: Article,
  },
  {
    label: 'Notifikasi',
    to: '/notifikasi',
    Icon: NotificationsOutlined,
    IconFilled: Notifications,
  },
  {
    label: 'Kelola',
    to: '/kelola',
    Icon: SettingsOutlined,
    IconFilled: Settings,
  },
] as const

let dynamicFormChildren: NavItem[] = []

export function setDynamicFormChildren(children: NavItem[]): void {
  dynamicFormChildren = children
}

function mergeDynamicChildren(items: NavItem[]): NavItem[] {
  return items.map((item) => {
    if (item.isDropdownTrigger && item.label === 'Formulir') {
      return { ...item, children: dynamicFormChildren }
    }
    return item
  })
}

/**
 * Semua pengguna melihat menu yang sama.
 */
export function navItemsForUser(): NavItem[] {
  return mergeDynamicChildren(NAV_ITEMS)
}

export function bottomNavItemsForUser(): NavItem[] {
  return navItemsForUser()
    .filter(
      (item) =>
        item.label !== 'Formulir' &&
        item.label !== 'Data Sasaran' &&
        item.label !== 'Kelola',
    )
    .slice(0, 5)
    .map((item) => ({ ...item, children: undefined }))
}
