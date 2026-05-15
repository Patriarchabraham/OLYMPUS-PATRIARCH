import type { SystemTheme } from './systemTheme.js'

export type ThemeChangeCallback = (theme: SystemTheme) => void

export function watchSystemTheme(
  querier: { query(text: string): Promise<string> },
  onThemeChange: ThemeChangeCallback,
): () => void {
  let currentBg = ''
  let intervalId: ReturnType<typeof setInterval> | undefined

  async function poll() {
    try {
      const response = await querier.query('\x1b]11;?\x07')
      if (response && response !== currentBg) {
        currentBg = response
        const theme: SystemTheme = isLightColor(response) ? 'light' : 'dark'
        onThemeChange(theme)
      }
    } catch {
      // Silently ignore query failures
    }
  }

  void poll()
  intervalId = setInterval(poll, 2000)

  return () => {
    if (intervalId !== undefined) {
      clearInterval(intervalId)
    }
  }
}

function isLightColor(colorResponse: string): boolean {
  const match = colorResponse.match(/rgb:([0-9a-f]+)\/([0-9a-f]+)\/([0-9a-f]+)/i)
  if (!match) return false
  const r = parseInt(match[1]!, 16)
  const g = parseInt(match[2]!, 16)
  const b = parseInt(match[3]!, 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5
}
