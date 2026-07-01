import { logForDebugging } from './debug.js'
import { gracefulShutdownSync } from './gracefulShutdown.js'

/**
 * Creates an idle timeout manager for SDK mode.
 * Automatically exits the process after the specified idle duration.
 *
 * @param isIdle Function that returns true if the system is currently idle
 * @returns Object with start/stop methods to control the idle timer
 */
export function createIdleTimeoutManager(isIdle: () => boolean): {
	start: () => void
	stop: () => void
} {
	// Parse CLAUDE_CODE_EXIT_AFTER_STOP_DELAY environment variable
	const exitAfterStopDelay = process.env.CLAUDE_CODE_EXIT_AFTER_STOP_DELAY
	const delayMs = exitAfterStopDelay ? parseInt(exitAfterStopDelay, 10) : null
	const isValidDelay = delayMs && !Number.isNaN(delayMs) && delayMs > 0

	let timer: NodeJS.Timeout | null = null
	let lastIdleTime = 0

	return {
		start() {
			// Clear any existing timer
			if (timer) {
				clearTimeout(timer)
				timer = null
			}

			// Only start timer if delay is configured and valid
			if (isValidDelay) {
				lastIdleTime = Date.now()

				const check = () => {
					const idleDuration = Date.now() - lastIdleTime
					if (isIdle() && idleDuration >= delayMs) {
						logForDebugging(`Exiting after ${delayMs}ms of idle time`)
						timer = null
						gracefulShutdownSync()
					} else {
						// Not idle yet — reschedule so we keep checking.
						// Previously the timer fired once and silently did nothing,
						// leaving the process alive indefinitely with no exit path.
						timer = setTimeout(check, delayMs)
					}
				}

				timer = setTimeout(check, delayMs)
			}
		},

		stop() {
			if (timer) {
				clearTimeout(timer)
				timer = null
			}
		},
	}
}
