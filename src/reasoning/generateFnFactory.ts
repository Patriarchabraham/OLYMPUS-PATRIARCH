/**
 * GenerateFn Factory — Creates LLM-backed generate functions for the reasoning module.
 *
 * Returns null when no LLM client is available. Callers must handle null
 * explicitly — reasoning functions throw when called without a real GenerateFn
 * rather than silently producing template-fabricated output.
 */

import type { GenerateFn } from './types.js'

/**
 * Attempt to create an LLM-backed generateFn using the project's API client.
 * Returns null if the client is not available (no API key, no network, etc).
 */
export async function createGenerateFn(): Promise<GenerateFn | null> {
	try {
		const { sideQuery } = await import('../utils/sideQuery.js')
		const { getSmallFastModel } = await import('../utils/model/model.js')

		const model = getSmallFastModel()

		const generate: GenerateFn = async (prompt: string): Promise<string> => {
			try {
				const response = await sideQuery({
					querySource: 'reasoning' as never,
					model,
					system: 'You are a reasoning engine. Respond with the requested format exactly.',
					messages: [{ role: 'user', content: prompt }],
					max_tokens: 2048,
					maxRetries: 1,
					temperature: 0.3,
				})

				const textParts: string[] = []
				for (const block of response.content) {
					if (block.type === 'text') {
						textParts.push(block.text)
					}
				}
				return textParts.join('\n') || ''
			} catch {
				return ''
			}
		}

		return generate
	} catch {
		return null
	}
}
