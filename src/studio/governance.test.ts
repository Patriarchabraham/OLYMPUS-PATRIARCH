import { describe, expect, it } from 'vitest'
import {
	applyAdminDirective,
	governanceNotes,
	loadGovernance,
	parseAdminDirective,
	resolvePolicy,
	setPolicyFromDirective,
} from './governance.js'

describe('studio governance — admin hierarchy', () => {
	it('resolvePolicy returns undefined when nothing is set', () => {
		const gov = loadGovernance()
		expect(resolvePolicy(gov, 'effects', 'requiredLibs')).toBeUndefined()
	})

	it('domain admin policy resolves', () => {
		let gov = loadGovernance()
		gov = applyAdminDirective(gov, 'effects.requiredLibs=gsap')
		expect(resolvePolicy(gov, 'effects', 'requiredLibs')).toBe('gsap')
	})

	it('Director (admin of admins) overrides a domain admin', () => {
		let gov = loadGovernance()
		gov = applyAdminDirective(gov, 'effects.requiredLibs=framer-motion') // domain sets one thing
		gov = applyAdminDirective(gov, 'director.effects.requiredLibs=gsap') // director overrides
		expect(resolvePolicy(gov, 'effects', 'requiredLibs')).toBe('gsap')
	})

	it('parseAdminDirective coerces scalars and lists', () => {
		expect(parseAdminDirective('design.maxFontFamilies=3')?.value).toBe(3)
		expect(parseAdminDirective('effects.allowMotion=false')?.value).toBe(false)
		expect(parseAdminDirective('effects.allowMotion=true')?.value).toBe(true)
		const list = parseAdminDirective('web.fonts=Inter,Roboto,Mono')
		expect(Array.isArray(list?.value)).toBe(true)
		expect(list?.value).toEqual(['Inter', 'Roboto', 'Mono'])
	})

	it('parseAdminDirective flags director level and keeps compound keys', () => {
		const d = parseAdminDirective('director.windows.stack=winui3')
		expect(d?.level).toBe('director')
		expect(d?.domain).toBe('windows')
		expect(d?.key).toBe('stack')
		expect(d?.value).toBe('winui3')
	})

	it('rejects unknown domains and malformed input', () => {
		expect(parseAdminDirective('bogus.key=1')).toBeNull()
		expect(parseAdminDirective('noequals')).toBeNull()
		expect(parseAdminDirective('effects')).toBeNull()
	})

	it('setPolicyFromDirective is immutable', () => {
		const gov = loadGovernance()
		const parsed = parseAdminDirective('design.maxFontFamilies=2')!
		const next = setPolicyFromDirective(gov, parsed)
		expect(resolvePolicy(gov, 'design', 'maxFontFamilies')).toBeUndefined()
		expect(resolvePolicy(next, 'design', 'maxFontFamilies')).toBe(2)
	})

	it('governanceNotes lists resolved policies tagged by origin', () => {
		let gov = loadGovernance()
		gov = applyAdminDirective(gov, 'effects.requiredLibs=gsap')
		gov = applyAdminDirective(gov, 'director.design.maxFontFamilies=3')
		const notes = governanceNotes(gov)
		expect(notes.some((n) => n.includes('[admin] effects.requiredLibs = gsap'))).toBe(true)
		expect(notes.some((n) => n.includes('[director] design.maxFontFamilies = 3'))).toBe(true)
	})

	it('windows domain policies round-trip', () => {
		let gov = loadGovernance()
		gov = applyAdminDirective(gov, 'windows.stack=winui3')
		gov = applyAdminDirective(gov, 'windows.packaging=msix')
		expect(resolvePolicy(gov, 'windows', 'stack')).toBe('winui3')
		expect(resolvePolicy(gov, 'windows', 'packaging')).toBe('msix')
	})
})
