import { describe, expect, it } from 'vitest'
import { getEnrichedRoleDefinition, getRoleDefinition } from '../roles.js'

describe('getEnrichedRoleDefinition', () => {
	it('appends the harness addendum to the base definition', () => {
		const base = getRoleDefinition('coder')
		const enriched = getEnrichedRoleDefinition('coder')
		expect(enriched.systemPromptAddendum.length).toBeGreaterThan(base.systemPromptAddendum.length)
		expect(enriched.systemPromptAddendum).toContain('Harness Addendum')
	})

	it('keeps base fields intact', () => {
		const base = getRoleDefinition('researcher')
		const enriched = getEnrichedRoleDefinition('researcher')
		expect(enriched.role).toBe(base.role)
		expect(enriched.capabilities).toEqual(base.capabilities)
		expect(enriched.expertiseWeight).toBe(base.expertiseWeight)
	})
})
