import { describe, it, expect } from 'vitest'
import { spawnCompany } from '../companyFactory.js'
import { getTemplateSlugs, getTemplate } from '../templates/index.js'
import type { CompanyFactoryInput } from '../companyFactory.js'

function makeInput(slug: string): CompanyFactoryInput {
	return {
		name: `Test ${slug} Corp`,
		description: `A test ${slug} company`,
		segmentSlug: slug,
		plan: 'starter',
		primaryColor: '#F59E0B',
	}
}

describe('companyFactory', () => {
	describe('spawnCompany', () => {
		it('spawns a company for every template', () => {
			const slugs = getTemplateSlugs()
			for (const slug of slugs) {
				const output = spawnCompany(makeInput(slug))
				expect(output.departments.length).toBeGreaterThan(0)
				expect(output.verifierAgents).toHaveLength(3)
				expect(output.kpis.length).toBeGreaterThan(0)
			}
		})

		it('throws for unknown segment', () => {
			expect(() => spawnCompany(makeInput('nonexistent'))).toThrow('Unknown industry segment')
		})

		it('scales agents by plan tier', () => {
			const starter = spawnCompany({ ...makeInput('tech'), plan: 'starter' })
			const pro = spawnCompany({ ...makeInput('tech'), plan: 'pro' })
			const enterprise = spawnCompany({ ...makeInput('tech'), plan: 'enterprise' })

			const starterAgents = starter.departments.reduce((sum, d) => sum + d.agents.length, 0)
			const proAgents = pro.departments.reduce((sum, d) => sum + d.agents.length, 0)
			const entAgents = enterprise.departments.reduce((sum, d) => sum + d.agents.length, 0)

			expect(proAgents).toBeGreaterThan(starterAgents)
			expect(entAgents).toBeGreaterThan(proAgents)
		})
	})

	describe('templates', () => {
		it('has 17 industry templates', () => {
			expect(getTemplateSlugs()).toHaveLength(17)
		})

		it('each template has departments with agents', () => {
			for (const slug of getTemplateSlugs()) {
				const template = getTemplate(slug)
				expect(template).toBeDefined()
				expect(template!.departments.length).toBeGreaterThan(0)
				for (const dept of template!.departments) {
					expect(dept.agents.length).toBeGreaterThan(0)
				}
			}
		})
	})
})
