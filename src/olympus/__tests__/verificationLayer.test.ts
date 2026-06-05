import { describe, it, expect } from 'vitest'
import { verifyOutput, autoFixContent } from '../verificationLayer.js'

describe('verificationLayer', () => {
	describe('verifyOutput', () => {
		it('returns exactly 5 verification results', () => {
			const results = verifyOutput('content', 'test-1', 'Hello World')
			expect(results).toHaveLength(5)
		})

		it('checks syntax, logic, security, quality, mathematical', () => {
			const results = verifyOutput('code', 'test-1', 'const x = 1;')
			const types = results.map((r) => r.checkType)
			expect(types).toEqual(['syntax', 'logic', 'security', 'quality', 'mathematical'])
		})

		it('flags XSS as security threat', () => {
			const results = verifyOutput('content', 'test-1', '<script>alert("xss")</script>')
			const security = results.find((r) => r.checkType === 'security')!
			expect(security.result).toMatch(/fail|warning/)
			expect(security.details.threats).toContain('xss_risk')
		})

		it('passes clean content', () => {
			const results = verifyOutput('content', 'test-1', 'This is a well-formed paragraph about business strategy.\n\nIt has multiple sections.')
			const allPass = results.every((r) => r.result === 'pass' || r.result === 'warning')
			expect(allPass).toBe(true)
		})
	})

	describe('autoFixContent', () => {
		it('removes null bytes', () => {
			const { content, fixed } = autoFixContent('Hello\x00World')
			expect(fixed).toBe(true)
			expect(content).toBe('HelloWorld')
		})

		it('removes control characters', () => {
			const { content, fixed } = autoFixContent('Test\x01\x02Content')
			expect(fixed).toBe(true)
			expect(content).toBe('TestContent')
		})

		it('normalizes multiple spaces', () => {
			const { content, fixed } = autoFixContent('Hello     World')
			expect(fixed).toBe(true)
			expect(content).toBe('Hello World')
		})

		it('returns unchanged content without issues', () => {
			const { content, fixed } = autoFixContent('Clean content')
			expect(fixed).toBe(false)
			expect(content).toBe('Clean content')
		})
	})
})
