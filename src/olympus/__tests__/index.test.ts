import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getOlympusEngine, resetOlympusEngine, OlympusEngine } from '../index.js'

describe('OlympusEngine', () => {
	beforeEach(() => {
		resetOlympusEngine()
	})

	afterEach(() => {
		resetOlympusEngine()
	})

	describe('singleton', () => {
		it('returns the same instance', () => {
			const a = getOlympusEngine()
			const b = getOlympusEngine()
			expect(a).toBe(b)
		})

		it('creates new instance after reset', () => {
			const a = getOlympusEngine()
			resetOlympusEngine()
			const b = getOlympusEngine()
			expect(a).not.toBe(b)
		})
	})

	describe('lifecycle', () => {
		it('initializes correctly', () => {
			const engine = new OlympusEngine()
			expect(engine.isInitialized()).toBe(false)
			engine.initialize()
			expect(engine.isInitialized()).toBe(true)
		})

		it('double-initialize is safe', () => {
			const engine = new OlympusEngine()
			engine.initialize()
			engine.initialize()
			expect(engine.isInitialized()).toBe(true)
		})
	})

	describe('company management', () => {
		it('spawns a company from template', () => {
			const engine = getOlympusEngine()
			const output = engine.spawnCompanyFromTemplate({
				name: 'Test Corp',
				description: 'Test',
				segmentSlug: 'tech',
				plan: 'starter',
				primaryColor: '#F59E0B',
			})

			expect(output.departments.length).toBeGreaterThan(0)
			expect(output.verifierAgents).toHaveLength(3)
		})

		it('lists active companies', () => {
			const engine = getOlympusEngine()
			engine.spawnCompanyFromTemplate({
				name: 'Test Corp',
				description: 'Test',
				segmentSlug: 'tech',
				plan: 'starter',
				primaryColor: '#F59E0B',
			})

			const companies = engine.listCompanies()
			expect(companies.length).toBe(1)
		})

		it('getTemplates returns 17 slugs', () => {
			const engine = getOlympusEngine()
			const templates = engine.getTemplates()
			expect(templates).toHaveLength(17)
		})
	})

	describe('shutdown', () => {
		it('clears all state on shutdown', () => {
			const engine = getOlympusEngine()
			engine.spawnCompanyFromTemplate({
				name: 'Test Corp',
				description: 'Test',
				segmentSlug: 'tech',
				plan: 'starter',
				primaryColor: '#F59E0B',
			})

			engine.shutdown()
			expect(engine.isInitialized()).toBe(false)
			expect(engine.listCompanies()).toHaveLength(0)
		})
	})
})
