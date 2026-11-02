import { NotifikasiBell } from '@/components/notifikasi/NotifikasiBell'
import { NotifikasiToast } from '@/components/notifikasi/NotifikasiToast'
import { PushOtomatis } from '@/components/notifikasi/PushOtomatis'
import ThemeToggle from '@/components/ui/ThemeToggle'

// export interface TopbarProps {
//   onToggleCollapse?: () => void
// }

export function Topbar() {
  return (
    <header className="sticky top-0 z-5 flex py-3.5 items-center gap-2.5 border-b border-line bg-surface px-7 max-md:px-3.5 max-md:gap-2 print:hidden">
      {/* <Button
        aria-label="Toggle sidebar"
        onClick={onToggleCollapse}
        variant="ghost"
        size="sm"
        className="px-0 max-md:hidden"
      >
        <Menu size={18} strokeWidth={1.8} />
      </Button>*/}
      <div className="ml-auto flex items-center gap-4">
        <PushOtomatis />
        <NotifikasiBell />
        <NotifikasiToast />
        <ThemeToggle />
      </div>
    </header>
  )
}
