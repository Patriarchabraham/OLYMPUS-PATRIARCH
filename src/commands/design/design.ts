import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.mjs'
import type { Command } from '../../commands.js'
import {
	PALETTE,
	tokensToCSSVars,
	checkContrast,
	renderAssessment,
	analyzeScreenshot,
} from '../../design/index.js'

const helpText = `[Design] — luxury design system (tokens + verification + vision).

Usage:
- /design tokens       Emit the luxury token system as CSS custom properties.
- /design check        Verify the brand palette against WCAG contrast.
- /design <image.png>  Measure a screenshot's craft (luminance, contrast,
                        edge density, palette discipline, whitespace).
- /design help         Show this help.

Luxury = disciplined fundamentals + restraint, measured — not effect-stacking.`

function paletteReport(): string {
	const pairs = [
		['brand on base', PALETTE.brand, PALETTE.dark.base],
		['accent on base', PALETTE.accent, PALETTE.dark.base],
		['neutral-100 on base', { r: 236, g: 238, b: 242 }, PALETTE.dark.base],
		['semantic.success on base', PALETTE.semantic.success, PALETTE.dark.base],
	] as const
	const lines = ['[Design Check] WCAG contrast of the luxury palette:']
	for (const [label, fg, bg] of pairs) {
		const c = checkContrast(fg, bg)
		lines.push(`  ${label}: ${c.ratio.toFixed(2)} → ${c.level}${c.pass ? '' : ' (FAIL)'}`)
	}
	return lines.join('\n')
}

const command = {
	type: 'prompt',
	name: 'design',
	description: 'Luxury design system: emit tokens, verify palette contrast, or measure a screenshot',
	isEnabled: () => true,
	progressMessage: 'design system',
	contentLength: 0,
	source: 'builtin',
	async getPromptForCommand(args?: string): Promise<ContentBlockParam[]> {
		const action = args?.trim() || 'help'
		if (action === 'help' || action === '') return [{ type: 'text', text: helpText }]
		if (action === 'tokens') return [{ type: 'text', text: tokensToCSSVars() }]
		if (action === 'check') return [{ type: 'text', text: paletteReport() }]
		// Otherwise treat as a screenshot path to measure.
		try {
			const buf = await import('node:fs').then((fs) => fs.readFileSync(action))
			const assessment = await analyzeScreenshot(buf)
			return [{ type: 'text', text: renderAssessment(assessment) }]
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e)
			return [{ type: 'text', text: `[Design] could not read image "${action}": ${msg}` }]
		}
	},
} satisfies Command

export default command
