import { Link } from '@tanstack/react-router'
import { bottomNavItemsForUser } from '@/lib/nav/nav'
import { useAuth } from '@/providers/auth'
import { LogOut } from 'lucide-react'

export function BottomNav() {
  const { logout } = useAuth()
  const items = bottomNavItemsForUser()

  return (
    <nav
      aria-label="Navigasi bawah"
      className="fixed bottom-0 left-0 right-0 z-20 flex items-stretch border-t border-line bg-surface pt-1.5 md:hidden print:hidden"
      style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
    >
      {items.map((item) => {
        const Icon = item.Icon
        return (
          <Link
            key={item.to}
            to={item.to}
            activeOptions={{ exact: item.to === '/' }}
            className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.75 rounded-lg py-1.5 px-0.5 text-[10px] font-semibold text-muted transition-colors"
            activeProps={{ className: 'bg-accent-light text-accent' }}
          >
            <Icon sx={{ fontSize: 20 }} />
            <span className="w-full truncate text-center">
              {item.shortLabel ?? item.label}
            </span>
          </Link>
        )
      })}
      <button
        type="button"
        onClick={() => void logout()}
        className="flex flex-1 flex-col items-center justify-center gap-[3px] rounded-lg py-1.5 text-[10px] font-semibold text-danger hover:bg-danger/10 transition-colors"
      >
        <LogOut size={20} strokeWidth={1.7} />
        <span className="truncate">Keluar</span>
      </button>
    </nav>
  )
}
