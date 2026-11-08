import { MoonIcon, SunIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { applyThemeMode, readThemeMode } from '@/lib/theme'
import type { ThemeMode } from '@/lib/theme'
import { ActionIcon, useMantineColorScheme } from '@mantine/core'

export default function ThemeToggle({ plain = false }: { plain?: boolean }) {
  const [mode, setMode] = useState<ThemeMode>('light')
  const { setColorScheme } = useMantineColorScheme()

  useEffect(() => {
    const initialMode = readThemeMode()
    setMode(initialMode)
    applyThemeMode(initialMode)
    setColorScheme(initialMode)
  }, [setColorScheme])

  /**
   * Ikuti perubahan sistem hanya selama user belum memilih sendiri. Begitu
   * `theme` sudah tersimpan, pilihan toggle yang menang.
   */
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      if (window.localStorage.getItem('theme')) return
      const modeSistem: ThemeMode = media.matches ? 'dark' : 'light'
      setMode(modeSistem)
      applyThemeMode(modeSistem)
      setColorScheme(modeSistem)
    }

    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [setColorScheme])

  /** Status bar PWA ikut warna tema, bukan selalu putih. */
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) {
      meta.setAttribute('content', mode === 'dark' ? '#0a1418' : '#ffffff')
    }
  }, [mode])

  function toggleMode() {
    const nextMode: ThemeMode = mode === 'light' ? 'dark' : 'light'
    setMode(nextMode)
    applyThemeMode(nextMode)
    setColorScheme(nextMode)
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
