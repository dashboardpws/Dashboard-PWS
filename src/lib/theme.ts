export type ThemeMode = 'light' | 'dark'

/** Preferensi sistem. Hanya jadi nilai awal sebelum user menekan toggle. */
function modeSistem(): ThemeMode {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

export function readThemeMode(): ThemeMode {
  if (typeof window === 'undefined') return 'light'
  const stored = window.localStorage.getItem('theme')
  if (stored === 'light' || stored === 'dark') return stored
  return modeSistem()
}

/**
 * Terapkan pilihan user APA ADANYA.
 *
 * Preferensi sistem tidak boleh menang saat `theme` sudah tersimpan. Kalau
 * `mode === 'dark'` masih dicek ke `prefers-color-scheme`, toggle ke dark tidak
 * berefek di HP yang sedang light mode — dan di PWA hasilnya tetap terang.
 */
export function applyThemeMode(mode: ThemeMode) {
  const root = document.documentElement
  root.classList.add('theme-anim')
  root.classList.remove('light', 'dark')
  root.classList.add(mode)
  if (mode === 'dark') {
    root.removeAttribute('data-theme')
  } else {
    root.setAttribute('data-theme', mode)
  }
  root.style.colorScheme = mode

  // Mantine menyimpan skema di key sendiri. Samakan supaya komponen Mantine
  // tidak tertinggal terang saat halaman sudah gelap.
  root.setAttribute('data-mantine-color-scheme', mode)
  window.localStorage.setItem('mantine-color-scheme-value', mode)

  window.setTimeout(() => root.classList.remove('theme-anim'), 400)
}

export const THEME_INIT_SCRIPT = `(function(){try{var stored=window.localStorage.getItem('theme');var mode=(stored==='light'||stored==='dark')?stored:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(mode);if(mode==='dark'){root.removeAttribute('data-theme')}else{root.setAttribute('data-theme',mode)}root.style.colorScheme=mode;root.setAttribute('data-mantine-color-scheme',mode);window.localStorage.setItem('mantine-color-scheme-value',mode);}catch(e){}})();`
