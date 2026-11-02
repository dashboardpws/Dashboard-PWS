import { MoonIcon, SunIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { applyThemeMode, readThemeMode } from '@/lib/theme'
import type { ThemeMode } from '@/lib/theme'
import { ActionIcon } from '@mantine/core'

export default function ThemeToggle({ plain = false }: { plain?: boolean }) {
  const [mode, setMode] = useState<ThemeMode>('light')

  useEffect(() => {
    const initialMode = readThemeMode()
    setMode(initialMode)
    applyThemeMode(initialMode)
  }, [])

  useEffect(() => {
    if (mode !== 'light') return

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyThemeMode('light')

    media.addEventListener('change', onChange)
    return () => {
      media.removeEventListener('change', onChange)
    }
  }, [mode])

  function toggleMode() {
    const nextMode: ThemeMode = mode === 'light' ? 'dark' : 'light'
    setMode(nextMode)
    applyThemeMode(nextMode)
    window.localStorage.setItem('theme', nextMode)
  }

  const label = `Theme mode: ${mode}. Click to switch mode.`

  return (
    <ActionIcon
      type="button"
      variant="light"
      radius="xl"
      size="lg"
      color="var(--lagoon-deep)"
      onClick={toggleMode}
      aria-label={label}
      title={label}
      className={plain ? '' : ' hover:text-accent!'}
    >
      {mode === 'dark' ? <MoonIcon size={20} /> : <SunIcon size={20} />}
    </ActionIcon>
  )
}
