import { describe, expect, it } from 'vitest'
import {
	applyMarketingDirective,
	KNOWN_MARKETING_POLICY_KEYS,
	loadMarketingGovernance,
	marketingGovernanceNotes,
	parseMarketingDirective,
	resolveMarketingPolicy,
	setMarketingPolicyFromDirective,
} from './governance.js'

describe('marketing governance — Director > domain > default', () => {
	it('loads an empty default governance', () => {
		const gov = loadMarketingGovernance()
		expect(gov.director.policies).toEqual({})
		expect(gov.admins).toEqual({})
	})

	it('parses bool / int / comma-list / string values', () => {
		expect(parseMarketingDirective('email.doubleOptIn=true')?.value).toBe(true)
		expect(parseMarketingDirective('analytics.attributionWindowDays=30')?.value).toBe(30)
		expect(parseMarketingDirective('social.channels=x,linkedin')?.value).toEqual(['x', 'linkedin'])
		expect(parseMarketingDirective('publish.approvalPolicy=ask-always')?.value).toBe('ask-always')
	})

	it('parses a director-scoped directive', () => {
		const p = parseMarketingDirective('director.copy.voice=bold')
		expect(p?.isDirector).toBe(true)
		expect(p?.domain).toBe('copy')
		expect(p?.key).toBe('voice')
	})

	it('rejects unknown domain or key', () => {
		expect(parseMarketingDirective('bogus.thing=x')).toBeNull()
		expect(parseMarketingDirective('copy.nothingHere=x')).toBeNull()
		expect(parseMarketingDirective('noequals')).toBeNull()
	})

	it('resolveMarketingPolicy: director overrides domain admin', () => {
		let gov = loadMarketingGovernance()
		gov = setMarketingPolicyFromDirective(gov, 'social.channels=x,linkedin')
		expect(resolveMarketingPolicy(gov, 'social', 'channels')).toEqual(['x', 'linkedin'])
		gov = setMarketingPolicyFromDirective(gov, 'director.social.channels=linkedin,youtube')
		expect(resolveMarketingPolicy(gov, 'social', 'channels')).toEqual(['linkedin', 'youtube'])
	})

	it('applyMarketingDirective is the engine convenience', () => {
		const gov = applyMarketingDirective(loadMarketingGovernance(), 'email.doubleOptIn=false')
		expect(resolveMarketingPolicy(gov, 'email', 'doubleOptIn')).toBe(false)
	})

	it('marketingGovernanceNotes renders director + admin policies distinctly', () => {
		let gov = loadMarketingGovernance()
		gov = setMarketingPolicyFromDirective(gov, 'social.channels=x')
		gov = setMarketingPolicyFromDirective(gov, 'director.publish.approvalPolicy=ask-always')
		const notes = marketingGovernanceNotes(gov)
		expect(notes.some((n) => n === 'social.channels = x')).toBe(true)
		expect(notes.some((n) => n === '[director] publish.approvalPolicy = ask-always')).toBe(true)
	})

	it('KNOWN_MARKETING_POLICY_KEYS enumerates the publish keys', () => {
		expect(KNOWN_MARKETING_POLICY_KEYS.publish).toContain('approvalPolicy')
		expect(KNOWN_MARKETING_POLICY_KEYS.publish).toContain('logging')
	})
})
