import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { runFormalAnalysisCheck } from './formalAnalysisHook.js'

describe('runFormalAnalysisCheck', () => {
	let tempDir: string

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), 'formal-analysis-'))
	})

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true })
	})

	it('returns null for non-JS file extensions', async () => {
		const filePath = join(tempDir, 'README.md')
		await writeFile(filePath, 'const user = null\nconst name = user.name\n', 'utf-8')
		const result = await runFormalAnalysisCheck('Edit', { file_path: filePath })
		expect(result).toBeNull()
	})

	it('returns null for non-edit tool names', async () => {
		const filePath = join(tempDir, 'foo.ts')
		await writeFile(filePath, 'const user = null\nconst name = user.name\n', 'utf-8')
		const result = await runFormalAnalysisCheck('Bash', { file_path: filePath })
		expect(result).toBeNull()
	})

	it('returns null for clean code (no findings)', async () => {
		const filePath = join(tempDir, 'clean.ts')
		await writeFile(filePath, 'const x = 5\nconst y = 10\n', 'utf-8')
		const result = await runFormalAnalysisCheck('Edit', { file_path: filePath })
		expect(result).toBeNull()
	})

	it('returns formatted findings for null dereference', async () => {
		const filePath = join(tempDir, 'null-deref.ts')
		await writeFile(filePath, 'const user = null\nconst name = user.name\n', 'utf-8')
		const result = await runFormalAnalysisCheck('Edit', { file_path: filePath })
		expect(result).not.toBeNull()
		expect(result).toContain('<formal_analysis engine="abstract-interpretation"')
		expect(result).toContain('[WRN]')
		expect(result).toContain('null')
		expect(result).toContain('</formal_analysis>')
	})

	it('returns formatted findings for division by zero', async () => {
		const filePath = join(tempDir, 'div-zero.ts')
		await writeFile(filePath, 'const x = 0\nconst y = 10 / x\n', 'utf-8')
		const result = await runFormalAnalysisCheck('Write', { file_path: filePath })
		expect(result).not.toBeNull()
		expect(result).toContain('<formal_analysis')
		expect(result).toMatch(/division|zero/i)
	})

	it('returns null when file does not exist', async () => {
		const result = await runFormalAnalysisCheck('Edit', {
			file_path: join(tempDir, 'does-not-exist.ts'),
		})
		expect(result).toBeNull()
	})

	it('returns null when file_path is missing or non-string', async () => {
		expect(await runFormalAnalysisCheck('Edit', {})).toBeNull()
		expect(await runFormalAnalysisCheck('Edit', { file_path: 123 })).toBeNull()
		expect(await runFormalAnalysisCheck('Edit', { file_path: '' })).toBeNull()
	})

	it('returns null for files larger than 2000 lines', async () => {
		const filePath = join(tempDir, 'huge.ts')
		const bigSource = 'const x = 0\nconst y = 10 / x\n'.repeat(1100) // ~2200 lines
		await writeFile(filePath, bigSource, 'utf-8')
		const result = await runFormalAnalysisCheck('Edit', { file_path: filePath })
		expect(result).toBeNull()
	})

	it('includes soundness score in output when findings exist', async () => {
		const filePath = join(tempDir, 'with-finding.ts')
		await writeFile(filePath, 'const user = null\nconst name = user.name\n', 'utf-8')
		const result = await runFormalAnalysisCheck('Edit', { file_path: filePath })
		expect(result).not.toBeNull()
		expect(result).toMatch(/soundness="\d+"/)
	})

	it('returns null instead of throwing when analysis engine errors', async () => {
		// Pass a path that exists but to a directory — readFile will fail.
		const result = await runFormalAnalysisCheck('Edit', { file_path: tempDir })
		expect(result).toBeNull()
	})
})
