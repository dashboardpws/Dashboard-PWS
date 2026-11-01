import { useCallback, useState } from 'react'
import type { ReactNode } from 'react'
import { Topbar } from './Topbar'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'

export interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false)
  const toggle = useCallback(() => setCollapsed((c) => !c), [])

  return (
    <div className="flex min-h-screen">
      <Sidebar collapsed={collapsed} onToggleCollapsed={toggle} />
      <div className="flex min-w-0 flex-1 flex-col bg-canvas">
        <Topbar />
        <div className="w-full max-w px-7 pb-8 pt-7 max-md:px-3.5 max-md:pb-21.5 max-md:pt-4">
          {children}
        </div>
      </div>
      <BottomNav />
    </div>
  )
}
