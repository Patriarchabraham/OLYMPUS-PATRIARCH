/**
 * Olympuz Marketing & Growth — system-prompt injection.
 *
 * Appends the compressed Marketing PRD to the existing system prompt when the
 * department is active. Early-returns the input unchanged when inactive (the
 * suite default under vitest), so call-sites stay byte-for-byte stable.
 */

import { isMarketingActive } from './marketingEngine.js'
import { MARKETING_PRD_COMPRESSED, MARKETING_PRD_VERSION } from './principles.js'

/**
 * Compose the Marketing PRD append for the system prompt.
 * Returns the input unchanged when Marketing is inactive.
 */
export function composeMarketingAppendSystemPrompt(
	existing: string | undefined,
): string | undefined {
	if (!isMarketingActive()) return existing
	const block = [
		'',
		'',
		`--- OLYMPUZ MARKETING & GROWTH DEPARTMENT (PRD v${MARKETING_PRD_VERSION}) ---`,
		'You have a Marketing & Growth Department. It plans and runs complete multi-channel',
		'campaigns (strategy, brand voice, copy, image + video creative, social, email, analytics).',
		'Safety bar: EVERY publish / send / post asks the user for approval BEFORE it goes out, and',
		'every published item is appended to the reversible published log. Use the /marketing command',
		'and the marketing-* specialist agents. Never publish confidential data or unverifiable claims.',
		'',
		MARKETING_PRD_COMPRESSED,
	].join('\n')
	return existing ? `${existing}${block}` : block.replace(/^\n\n/, '')
}
