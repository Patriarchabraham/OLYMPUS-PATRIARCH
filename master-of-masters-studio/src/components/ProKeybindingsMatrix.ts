/**
 * Master of Masters Studio Pro — Pro Audio Keyboard Shortcuts Matrix.
 *
 * Provides zero-latency studio hotkeys:
 * - [Space] : Play / Pause
 * - [A]     : Switch to Original Mix
 * - [B]     : Switch to Master Output
 * - [M]     : Toggle Mono Check
 * - [R]     : Jump to Loudest Section / Chorus
 * - [L]     : Toggle Real-Time Live Audition
 */

export class ProKeybindingsMatrix {
	private static isInitialized = false

	public static init(): void {
		if (ProKeybindingsMatrix.isInitialized) return
		ProKeybindingsMatrix.isInitialized = true

		window.addEventListener('keydown', (e: KeyboardEvent) => {
			// Ignore when user is typing in input or select
			const activeTag = document.activeElement?.tagName.toLowerCase()
			if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') return

			switch (e.code) {
				case 'Space':
					e.preventDefault()
					document.getElementById('btn-transport-play')?.click()
					break

				case 'KeyA':
					e.preventDefault()
					document.getElementById('btn-ab-orig')?.click()
					break

				case 'KeyB':
					e.preventDefault()
					document.getElementById('btn-ab-master')?.click()
					break

				case 'KeyD':
					e.preventDefault()
					document.getElementById('btn-dim')?.click()
					break

				case 'KeyM':
					e.preventDefault()
					document.getElementById('btn-mono-check')?.click()
					break

				case 'KeyR':
					e.preventDefault()
					document.getElementById('btn-jump-loudest')?.click()
					break

				case 'KeyL':
					e.preventDefault()
					document.getElementById('btn-toggle-live-audition')?.click()
					break

				case 'Digit1':
				case 'Digit2':
				case 'Digit3':
				case 'Digit4':
				case 'Digit5':
				case 'Digit6':
				case 'Digit7':
				case 'Digit8':
				case 'Digit9': {
					const tabIndex = parseInt(e.key, 10) - 1
					const tabs = document.querySelectorAll('.studio-tab') as NodeListOf<HTMLButtonElement>
					if (tabs[tabIndex]) {
						e.preventDefault()
						tabs[tabIndex].click()
					}
					break
				}
			}

			if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
				e.preventDefault()
				document.getElementById('btn-process-master')?.click()
			}
		})
	}
}
