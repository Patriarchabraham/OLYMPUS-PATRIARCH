import { afterEach, describe, expect, test, vi } from 'vitest'

async function importFileModuleWithKillswitchEnabled(killswitchEnabled: boolean) {
	vi.mock('../services/analytics/growthbook.js', () => ({
		getFeatureValue_CACHED_MAY_BE_STALE: () => killswitchEnabled,
	}))

	vi.resetModules()
	return vi.importActual('./file.js')
}

afterEach(() => {
	vi.restoreAllMocks()
})

describe('addLineNumbers', () => {
	test('uses unambiguous arrow compact prefix and preserves leading tabs', async () => {
		const { addLineNumbers } = await importFileModuleWithKillswitchEnabled(false)

		const result = addLineNumbers({
			content: '\tfirst\n\t\tsecond',
			startLine: 41,
		})

		expect(result).toBe('41→\tfirst\n42→\t\tsecond')
	})

	test('keeps padded arrow format when compact mode is disabled', async () => {
		const { addLineNumbers } = await importFileModuleWithKillswitchEnabled(true)

		const result = addLineNumbers({
			content: 'alpha\nbeta',
			startLine: 1,
		})

		expect(result).toBe('     1→alpha\n     2→beta')
	})
})

describe('stripLineNumberPrefix', () => {
	test('strips compact arrow, padded arrow, and legacy tab prefixes', async () => {
		const { stripLineNumberPrefix } = await importFileModuleWithKillswitchEnabled(false)

		expect(stripLineNumberPrefix('41→\tfirst')).toBe('\tfirst')
		expect(stripLineNumberPrefix('     2→beta')).toBe('beta')
		expect(stripLineNumberPrefix('7\t\tlegacy-tab')).toBe('\tlegacy-tab')
	})
})
