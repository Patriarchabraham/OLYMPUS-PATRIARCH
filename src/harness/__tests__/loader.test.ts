import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { zipSync } from 'fflate'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
	_resetHarnessLoader,
	getDoctrineSection,
	getFullCorpus,
	getRoleAddendum,
	listCorpus,
	loadFromBundle,
} from '../loader.js'

beforeEach(() => _resetHarnessLoader())

describe('harness loader (filesystem corpus)', () => {
	it('returns a non-empty addendum for every role', () => {
		const roles = [
			'researcher',
			'coder',
			'tester',
			'reviewer',
			'architect',
			'dataAnalyst',
			'general',
		] as const
		for (const role of roles) {
			const addendum = getRoleAddendum(role)
			expect(addendum, `role ${role}`).not.toBeNull()
			expect(addendum!.trim().length).toBeGreaterThan(0)
		}
	})

	it('returns the operating doctrine section', () => {
		const doctrine = getDoctrineSection('00-operating-doctrine')
		expect(doctrine).not.toBeNull()
		expect(doctrine).toContain('Honesty over theater')
	})

	it('returns null for a missing section', () => {
		expect(getDoctrineSection('does-not-exist')).toBeNull()
	})

	it('lists every corpus file', () => {
		const entries = listCorpus()
		expect(entries.length).toBeGreaterThanOrEqual(16)
		expect(entries.some((e) => e.path === '00-operating-doctrine.md')).toBe(true)
		expect(entries.some((e) => e.path === '20-role-coder.md')).toBe(true)
	})

	it('returns the adversarial-verification and reasoning-depth layers', () => {
		const adv = getDoctrineSection('03-adversarial-verification')
		expect(adv).not.toBeNull()
		expect(adv).toContain('try to refute')
		const depth = getDoctrineSection('13-reasoning-depth')
		expect(depth).not.toBeNull()
		expect(depth).toContain('reflection')
	})

	it('concatenates the full corpus in sorted order', () => {
		const full = getFullCorpus()
		expect(full).toContain('# 00-operating-doctrine.md')
		expect(full).toContain('# 30-security-and-governance.md')
	})
})

describe('loadFromBundle', () => {
	let dir: string

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), 'harness-'))
		_resetHarnessLoader()
	})
	afterEach(() => rmSync(dir, { recursive: true, force: true }))

	it('loads corpus .md files from a compressed bundle and overrides fs hydration', () => {
		const zipped = zipSync({
			'99-bundled-section.md': new Uint8Array(
				Buffer.from('# Bundled Doctrine\nReal bundled content.', 'utf8'),
			),
			'manifest.json': new Uint8Array(Buffer.from('{}', 'utf8')),
		})
		const zipPath = join(dir, 'bundle.zip')
		writeFileSync(zipPath, zipped)

		expect(loadFromBundle(zipPath)).toBe(true)
		expect(getDoctrineSection('99-bundled-section')).toBe(
			'# Bundled Doctrine\nReal bundled content.',
		)
		// Bundle hydration overrides filesystem — a filesystem-only section is absent.
		expect(getDoctrineSection('00-operating-doctrine')).toBeNull()
	})

	it('returns false for a missing or invalid bundle', () => {
		expect(loadFromBundle(join(dir, 'nope.zip'))).toBe(false)
	})
})
