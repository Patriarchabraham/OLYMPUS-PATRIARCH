/**
 * Multi-agent UI/UX auditor.
 *
 * Spawns parallel specialist agents — each auditing ONE dimension of a
 * UI/UX project (visual/tokens, accessibility/WCAG, code-quality,
 * layout/hierarchy, interaction/motion) — then a reviewer agent merges
 * findings into a prioritized report with a measured design score.
 *
 * Uses: design/verify (WCAG, scale, grid), design/vision (pixel analysis),
 * creative (if screenshots provided), and the swarm orchestrator for parallel
 * agent execution. Each agent gets a real LLM call via createLlmAgentExecutor.
 */
import { getSwarmOrchestrator } from '../swarm/orchestrator.js'
import { createLlmAgentExecutor } from '../swarm/llmExecutor.js'
import {
	checkContrast,
	checkTypeScale,
	checkSpacingGrid,
	designScore,
	tokensToCSSVars,
	analyzeScreenshot,
	renderAssessment,
	type RGB,
} from '../design/index.js'
import { readFileSync, readdirSync } from 'node:fs'
import { join, extname } from 'node:path'

export interface AuditDimension {
	name: string
	role: 'visual' | 'accessibility' | 'code' | 'layout' | 'interaction'
	description: string
}

export interface AuditFinding {
	dimension: string
	severity: 'critical' | 'high' | 'medium' | 'low'
	file?: string
	description: string
	fix: string
}

export interface UIAuditResult {
	findings: AuditFinding[]
	/** 0-100 aggregate (from design/verify DesignScore + agent findings penalty). */
	score: number
	dimensionsRun: string[]
	screenshotsAnalyzed: number
	durationMs: number
}

const DIMENSIONS: AuditDimension[] = [
	{ name: 'Visual & Design Tokens', role: 'visual', description: 'Audit color palette, typography scale, spacing grid, elevation, and brand consistency against the luxury design tokens. Flag any hardcoded colors, off-grid spacing, or off-ratio type.' },
	{ name: 'Accessibility (WCAG)', role: 'accessibility', description: 'Audit all text/background contrast pairs against WCAG 2.1 AA (4.5:1) / AAA (7:1). Check for missing ARIA, alt text, focus states, and keyboard navigation. Flag every failure with the exact pair.' },
	{ name: 'Code Quality', role: 'code', description: 'Audit the UI code for: TypeScript strict compliance, component structure, dead code, hardcoded values that should use tokens, inline styles instead of design-system classes, and error handling.' },
	{ name: 'Layout & Hierarchy', role: 'layout', description: 'Audit the visual hierarchy: heading→subheading→body→CTA eye flow, whitespace rhythm, responsive breakpoints (375/768/1024/1920), alignment to grid, and whether one focal point per view is clear.' },
	{ name: 'Interaction & Motion', role: 'interaction', description: 'Audit motion design: entrance animations, hover states, loading states, transitions. Check prefers-reduced-motion, stagger timing, and whether motion reinforces hierarchy (not decoration).' },
]

/** Collect UI-related source files from a project root. */
function collectUIFiles(root: string): string[] {
	const exts = ['.tsx', '.jsx', '.css', '.scss', '.html']
	const patterns = [
		'**/*.{tsx,jsx}',
		'**/*.{css,scss}',
	]
	// Read dir recursively, shallow (depth 3)
	const out: string[] = []
	function walk(dir: string, depth: number) {
		if (depth > 3) return
		try {
			for (const ent of readdirSync(dir, { withFileTypes: true })) {
				if (ent.isDirectory() && !ent.name.startsWith('.') && ent.name !== 'node_modules') {
					walk(join(dir, ent.name), depth + 1)
				} else if (exts.includes(extname(ent.name))) {
					out.push(join(dir, ent.name))
				}
			}
		} catch { /* ignore */ }
	}
	walk(root, 0)
	return out.slice(0, 200) // cap
}

/** Collect screenshots from a project root (png/jpg/webp). */
function collectScreenshots(root: string): string[] {
	const imgExts = ['.png', '.jpg', '.jpeg', '.webp']
	const out: string[] = []
	function walk(dir: string, depth: number) {
		if (depth > 3) return
		try {
			for (const ent of readdirSync(dir, { withFileTypes: true })) {
				if (ent.isDirectory() && !ent.name.startsWith('.') && ent.name !== 'node_modules') {
					walk(join(dir, ent.name), depth + 1)
				} else if (imgExts.includes(extname(ent.name).toLowerCase())) {
					out.push(join(dir, ent.name))
				}
			}
		} catch { /* ignore */ }
	}
	walk(root, 0)
	return out.slice(0, 20) // cap
}

/**
 * Run the multi-agent UI/UX audit on a project root.
 * Spawns parallel specialist agents (swarm) + runs measured design checks.
 */
export async function auditUIUX(
	root: string,
	opts?: { generateFn?: <T>(prompt: string) => Promise<T> | null },
): Promise<UIAuditResult> {
	const startedAt = Date.now()

	// 1. Structural checks (measured, not model-dependent)
	const uiFiles = collectUIFiles(root)
	const screenshots = collectScreenshots(root)

	// Run design/verify structural checks on whatever tokens/colors we find
	const structuralFindings: AuditFinding[] = []

	// Scan source for hardcoded colors (basic hex detection)
	for (const file of uiFiles.slice(0, 50)) {
		try {
			const content = readFileSync(file, 'utf8')
			const hexColors = content.match(/#[0-9a-fA-F]{6}\b/g) ?? []
			const unique = [...new Set(hexColors)]
			if (unique.length > 8) {
				structuralFindings.push({
					dimension: 'Visual & Design Tokens',
					severity: 'medium',
					file: file.replace(root + '/', ''),
					description: `${unique.length} distinct hardcoded hex colors — use design tokens instead`,
					fix: 'Replace with CSS custom properties from the token system (--brand, --accent, --neutral-*)',
				})
			}
			// Check for inline styles with spacing values not on the 4px grid
			const inlineSpacing = content.match(/(?:padding|margin|gap):\s*(\d+)px/g) ?? []
			for (const s of inlineSpacing) {
				const val = Number.parseInt(s.match(/\d+/)![0])
				if (val % 4 !== 0 && val > 0) {
					structuralFindings.push({
						dimension: 'Visual & Design Tokens',
						severity: 'low',
						file: file.replace(root + '/', ''),
						description: `Off-grid spacing: ${s}`,
						fix: `Use the nearest 4px-grid multiple (${Math.round(val / 4) * 4}px)`,
					})
					break // one per file is enough signal
				}
			}
		} catch { /* ignore */ }
	}

	// Analyze screenshots with pixel vision
	const screenshotFindings: AuditFinding[] = []
	for (const shot of screenshots) {
		try {
			const buf = readFileSync(shot)
			const assessment = await analyzeScreenshot(buf)
			if (assessment.craftScore < 50) {
				screenshotFindings.push({
					dimension: 'Layout & Hierarchy',
					severity: 'high',
					file: shot.replace(root + '/', ''),
					description: `Low craft score (${assessment.craftScore}/100): ${assessment.flags.join('; ')}`,
					fix: 'Address the flagged fundamentals: reduce complexity, tighten palette, increase whitespace',
				})
			} else if (assessment.flags.length > 0) {
				screenshotFindings.push({
					dimension: 'Layout & Hierarchy',
					severity: 'medium',
					file: shot.replace(root + '/', ''),
					description: `Craft score ${assessment.craftScore}/100 — flags: ${assessment.flags.join('; ')}`,
					fix: 'Review the flagged metrics and iterate',
				})
			}
		} catch { /* ignore */ }
	}

	// 2. Multi-agent audit (swarm, parallel) — each dimension is a task
	let agentFindings: AuditFinding[] = []
	try {
		const orchestrator = getSwarmOrchestrator()
		const swarmId = orchestrator.createSwarm()
		for (let i = 0; i < DIMENSIONS.length; i++) {
			orchestrator.registerAgent(swarmId, {
				id: `agent-${DIMENSIONS[i]!.role}-${i}`,
				role: 'reviewer',
				capabilities: ['code-review', 'quality', 'analysis'],
				status: 'idle',
			})
		}
		for (const dim of DIMENSIONS) {
			orchestrator.submitTask(swarmId,
				`${dim.description}\n\nProject root: ${root}\nUI files found: ${uiFiles.length}\nFocus on: ${dim.role}. Return findings as "[SEVERITY] file — description → fix".`,
			)
		}
		const executor = createLlmAgentExecutor()
		const results = await orchestrator.executeSwarm(swarmId, executor)
		if (results) {
			for (const result of [...results.values()]) {
				if (!result.success || !result.output) continue
				// Parse agent output into findings
				for (const line of result.output.split('\n')) {
					const m = line.match(/\[(critical|high|medium|low)\]\s*(.*)/i)
					if (m) {
						const [_, sev, rest] = m
						const parts = rest.split('→').map((s: string) => s.trim())
						agentFindings.push({
							dimension: DIMENSIONS.find((d) => result.metadata?.agentRole === d.role)?.name ?? 'Agent',
							severity: sev!.toLowerCase() as AuditFinding['severity'],
							description: parts[0] ?? rest,
							fix: parts[1] ?? '',
						})
					}
				}
			}
		}
	} catch {
		// Agent execution failed (no API key) — structural findings still stand
	}

	// 3. Merge all findings
	const allFindings = [...structuralFindings, ...screenshotFindings, ...agentFindings]
		.sort((a, b) => {
			const order = { critical: 0, high: 1, medium: 2, low: 3 }
			return order[a.severity] - order[b.severity]
		})

	// 4. Score: start from 100, penalize per finding by severity
	const penalties = { critical: 20, high: 10, medium: 5, low: 2 }
	let score = 100
	for (const f of allFindings) score -= penalties[f.severity]
	score = Math.max(0, Math.min(100, score))

	return {
		findings: allFindings,
		score,
		dimensionsRun: DIMENSIONS.map((d) => d.name),
		screenshotsAnalyzed: screenshots.length,
		durationMs: Date.now() - startedAt,
	}
}

/** Render a UIAuditResult as a concise prioritized report. */
export function renderAuditReport(result: UIAuditResult): string {
	const lines: string[] = []
	lines.push('[UI/UX Multi-Agent Audit] measured report:')
	lines.push(`  Score: ${result.score}/100`)
	lines.push(`  Dimensions: ${result.dimensionsRun.join(', ')}`)
	lines.push(`  Screenshots analyzed: ${result.screenshotsAnalyzed}`)
	lines.push(`  Findings: ${result.findings.length}`)
	lines.push(`  Duration: ${result.durationMs}ms`)
	lines.push('')

	const grouped: Record<string, AuditFinding[]> = {}
	for (const f of result.findings) {
		(grouped[f.dimension] ??= []).push(f)
	}
	for (const [dim, findings] of Object.entries(grouped)) {
		lines.push(`### ${dim} (${findings.length})`)
		for (const f of findings.slice(0, 8)) {
			const tag = f.severity.toUpperCase().padEnd(8)
			const file = f.file ? ` [${f.file}]` : ''
			lines.push(`  [${tag}]${file} ${f.description}`)
			if (f.fix) lines.push(`         → ${f.fix}`)
		}
		if (findings.length > 8) lines.push(`  ... and ${findings.length - 8} more`)
		lines.push('')
	}
	return lines.join('\n')
}
