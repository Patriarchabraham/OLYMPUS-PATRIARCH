import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { _resetForTest, runCrossFileImpactCheck } from './crossFileImpactHook.js'

describe('runCrossFileImpactCheck', () => {
	let tempProject: string
	let savedCwd: typeof process.cwd

	beforeEach(async () => {
		tempProject = await mkdtemp(join(tmpdir(), 'cross-file-impact-'))
		// The hook walks process.cwd()/src — point cwd at the temp project.
		savedCwd = process.cwd
		process.cwd = () => tempProject
		await mkdir(join(tempProject, 'src'), { recursive: true })
		_resetForTest()
	})

	afterEach(async () => {
		process.cwd = savedCwd
		_resetForTest()
		await rm(tempProject, { recursive: true, force: true })
	})

	it('returns null for non-edit tool names', async () => {
		const filePath = join(tempProject, 'src', 'foo.ts')
		await writeFile(filePath, 'export const foo = 1\n', 'utf-8')
		const result = await runCrossFileImpactCheck('Bash', { file_path: filePath })
		expect(result).toBeNull()
	})

	it('returns null for non-tracked extensions', async () => {
		const filePath = join(tempProject, 'src', 'README.md')
		await writeFile(filePath, '# readme\n', 'utf-8')
		const result = await runCrossFileImpactCheck('Edit', { file_path: filePath })
		expect(result).toBeNull()
	})

	it('returns null when the edited file has no importers', async () => {
		const target = join(tempProject, 'src', 'target.ts')
		await writeFile(target, 'export const value = 42\n', 'utf-8')
		// No other file imports target.ts
		const result = await runCrossFileImpactCheck('Edit', { file_path: target })
		expect(result).toBeNull()
	})

	it('returns formatted impact block when importers exist', async () => {
		const target = join(tempProject, 'src', 'target.ts')
		const importerPath = join(tempProject, 'src', 'consumer.ts')
		await writeFile(target, 'export const value = 42\n', 'utf-8')
		await writeFile(
			importerPath,
			"import { value } from './target.js'\nexport const doubled = value * 2\n",
			'utf-8',
		)

		const result = await runCrossFileImpactCheck('Edit', { file_path: target })
		expect(result).not.toBeNull()
		expect(result).toContain('<cross_file_impact')
		expect(result).toContain('importers="1"')
		expect(result).toContain('consumer.ts')
		expect(result).toContain('</cross_file_impact>')
	})

	it('counts multiple importers correctly', async () => {
		const target = join(tempProject, 'src', 'shared.ts')
		await writeFile(target, 'export const shared = 1\n', 'utf-8')
		await writeFile(
			join(tempProject, 'src', 'a.ts'),
			"import { shared } from './shared.js'\n",
			'utf-8',
		)
		await writeFile(
			join(tempProject, 'src', 'b.ts'),
			"import { shared } from './shared.js'\n",
			'utf-8',
		)
		await writeFile(
			join(tempProject, 'src', 'c.ts'),
			"import { shared } from './shared.js'\n",
			'utf-8',
		)

		const result = await runCrossFileImpactCheck('Write', { file_path: target })
		expect(result).not.toBeNull()
		expect(result).toContain('importers="3"')
		expect(result).toContain('a.ts')
		expect(result).toContain('b.ts')
		expect(result).toContain('c.ts')
	})

	it('detects dynamic import() as well as static imports', async () => {
		const target = join(tempProject, 'src', 'lazy.ts')
		await writeFile(target, 'export const x = 1\n', 'utf-8')
		await writeFile(
			join(tempProject, 'src', 'loader.ts'),
			"const mod = await import('./lazy.js')\n",
			'utf-8',
		)

		const result = await runCrossFileImpactCheck('Edit', { file_path: target })
		expect(result).not.toBeNull()
		expect(result).toContain('loader.ts')
	})

	it('ignores bare specifiers (npm packages and node: imports)', async () => {
		const target = join(tempProject, 'src', 'node.ts')
		await writeFile(target, 'export const x = 1\n', 'utf-8')
		// Imports 'fs' and 'chalk' — neither is a relative project file.
		await writeFile(
			join(tempProject, 'src', 'uses-npm.ts'),
			"import { readFileSync } from 'node:fs'\nimport chalk from 'chalk'\n",
			'utf-8',
		)

		const result = await runCrossFileImpactCheck('Edit', { file_path: target })
		expect(result).toBeNull()
	})

	it('returns null when file_path is missing or non-string', async () => {
		expect(await runCrossFileImpactCheck('Edit', {})).toBeNull()
		expect(await runCrossFileImpactCheck('Edit', { file_path: 123 })).toBeNull()
		expect(await runCrossFileImpactCheck('Edit', { file_path: '' })).toBeNull()
	})

	it('resolves tracked extensions even when the import omits one', async () => {
		const target = join(tempProject, 'src', 'extless.ts')
		await writeFile(target, 'export const v = 1\n', 'utf-8')
		// Import path uses no extension at all (TS convention)
		await writeFile(
			join(tempProject, 'src', 'imports-extless.ts'),
			"import { v } from './extless'\n",
			'utf-8',
		)

		const result = await runCrossFileImpactCheck('Edit', { file_path: target })
		expect(result).not.toBeNull()
		expect(result).toContain('imports-extless.ts')
	})

	it('reuses the cached reverse-import graph across calls', async () => {
		const target = join(tempProject, 'src', 'cached.ts')
		const importer = join(tempProject, 'src', 'cached-importer.ts')
		await writeFile(target, 'export const x = 1\n', 'utf-8')
		await writeFile(importer, "import { x } from './cached.js'\n", 'utf-8')

		// First call builds the graph
		const first = await runCrossFileImpactCheck('Edit', { file_path: target })
		expect(first).not.toBeNull()
		expect(first).toContain('importers="1"')

		// Second call should reuse cache (still 1 importer even if we add a new file
		// after the build — graph staleness is by design per docstring)
		await writeFile(
			join(tempProject, 'src', 'uncached-new.ts'),
			"import { x } from './cached.js'\n",
			'utf-8',
		)
		const second = await runCrossFileImpactCheck('Edit', { file_path: target })
		expect(second).toContain('importers="1"') // cached, not re-walked
	})

	it('returns null instead of throwing when file does not exist', async () => {
		const result = await runCrossFileImpactCheck('Edit', {
			file_path: join(tempProject, 'src', 'does-not-exist.ts'),
		})
		expect(result).toBeNull()
	})
})
