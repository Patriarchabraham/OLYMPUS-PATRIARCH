import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, test } from 'vitest'

import { getClaudeConfigHomeDir } from '../utils/envUtils.js'
import { clearSkillCaches, getSkillDirCommands } from './loadSkillsDir.ts'

// getClaudeConfigHomeDir is memoized on CLAUDE_CONFIG_DIR; clear it so each
// test's CLAUDE_CONFIG_DIR override takes effect instead of returning a stale
// value cached from the real ~/.openclaude on this dev box. Without this, the
// user-skills source leaks the real installed skills (ailex, design-evolution,
// ...) into the test, breaking the exact-list assertion below.
function clearConfigHomeCache(): void {
	const fn = getClaudeConfigHomeDir as unknown as {
		cache?: { clear?: () => void }
	}
	fn.cache?.clear?.()
}

// Mark `dir` as a git repository root so getProjectDirsUpToHome's walk-up stops
// at it. Without this, on Windows the temp cwd (under an 8.3 short-name path
// like C:\Users\PATRIA~1\...) walks all the way to the real home directory
// because the home-boundary comparison (long name "Patriarch Romana") never
// matches the short-name ancestor, leaking the user's real ~/.openclaude/skills
// into the test. A real git root is the same boundary the production walk uses.
function markAsGitRoot(dir: string): void {
	if (existsSync(join(dir, '.git'))) return
	try {
		execFileSync('git', ['init', '--quiet', dir], { stdio: 'ignore' })
	} catch {
		// git unavailable: fall back to an empty .git dir, which findGitRoot still
		// accepts as a repo boundary (it only stats .git, not its contents).
		mkdirSync(join(dir, '.git'), { recursive: true })
	}
}

const originalConfigDir = process.env.CLAUDE_CONFIG_DIR

beforeEach(() => {
	clearConfigHomeCache()
	clearSkillCaches()
})

afterEach(() => {
	if (originalConfigDir === undefined) {
		delete process.env.CLAUDE_CONFIG_DIR
	} else {
		process.env.CLAUDE_CONFIG_DIR = originalConfigDir
	}
	clearConfigHomeCache()
	clearSkillCaches()
})

function writeSkill(rootDir: string, skillPath: string): void {
	const skillDir = join(rootDir, '.claude', 'skills', ...skillPath.split('/'))
	mkdirSync(skillDir, { recursive: true })
	writeFileSync(
		join(skillDir, 'SKILL.md'),
		`---\ndescription: ${skillPath}\n---\n# ${skillPath}\n`,
		'utf8',
	)
}

test('loads flat and nested skills with colon namespaces', async () => {
	const configDir = mkdtempSync(join(tmpdir(), 'Olympuz Coder-skills-'))
	const cwd = join(configDir, 'workspace')

	try {
		mkdirSync(cwd, { recursive: true })
		// configDir is the git/project root: the walk-up stops here, preventing the
		// real home skills from leaking in, while still discovering configDir's own
		// .claude/skills tree written below.
		markAsGitRoot(configDir)
		writeSkill(configDir, 'flat-skill')
		writeSkill(configDir, 'git/commit')
		writeSkill(configDir, 'frontend/react/form')

		process.env.CLAUDE_CONFIG_DIR = configDir
		clearConfigHomeCache()
		clearSkillCaches()

		const skills = await getSkillDirCommands(cwd)
		const promptSkills = skills.filter((skill) => skill.type === 'prompt')
		const skillNames = promptSkills.map((skill) => skill.name).sort()

		expect(skillNames).toEqual(['flat-skill', 'frontend:react:form', 'git:commit'])

		const nestedSkill = promptSkills.find((skill) => skill.name === 'git:commit')
		expect(nestedSkill).toBeTruthy()
		expect(nestedSkill?.skillRoot).toBe(join(configDir, '.claude', 'skills', 'git', 'commit'))

		const deepSkill = promptSkills.find((skill) => skill.name === 'frontend:react:form')
		expect(deepSkill).toBeTruthy()
		expect(deepSkill?.skillRoot).toBe(
			join(configDir, '.claude', 'skills', 'frontend', 'react', 'form'),
		)
	} finally {
		rmSync(configDir, { recursive: true, force: true })
	}
})
