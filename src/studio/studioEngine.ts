/**
 * Olympuz Studio — Engine (lazy singleton, mirrors getEvolutionEngine).
 *
 * Owns the StudioConfig + governance and exposes the operations the rest of the
 * system needs: PRD injection text, intent detection, department planning, token
 * generation, and curation. The only stateful studio module.
 *
 * Test-safety keystone: `isStudioActive()` is false whenever `isTestEnv()` is
 * true, regardless of config — so the 2639-test suite is byte-for-byte
 * unaffected unless a test explicitly forces active.
 */

import { runCurator as curatorRun } from './curator.js'
import { planDepartment } from './department.js'
import { generateDesignTokens } from './designTokens.js'
import { applyAdminDirective, loadGovernance } from './governance.js'
import { detectStudioIntent, isStudioBuildIntent } from './intent.js'
import { STUDIO_PRD_COMPRESSED, STUDIO_PRD_VERSION } from './principles.js'
import type {
	DepartmentPlan,
	DesignTokens,
	StudioAesthetic,
	StudioConfig,
	StudioGovernance,
	StudioIntensity,
	StudioIntent,
	StudioPlatform,
	StudioRunResult,
} from './types.js'

/** True under vitest / NODE_ENV=test. The single test-safety signal. */
export function isTestEnv(): boolean {
	return Boolean(process.env.VITEST) || process.env.NODE_ENV === 'test'
}

export const DEFAULT_STUDIO_CONFIG: StudioConfig = {
	enabled: true,
	autoActivate: true,
	intensity: 'ultra',
	defaultPlatform: 'web',
	aesthetic: 'neutral-adaptive',
	prdVersion: STUDIO_PRD_VERSION,
}

export interface GenerateTokensOptions {
	baseColor?: string
	mood?: StudioAesthetic
	platform?: StudioPlatform
	intensity?: StudioIntensity
}

export class StudioEngine {
	config: StudioConfig
	governance: StudioGovernance
	private _testForceActive = false

	constructor(config: StudioConfig = DEFAULT_STUDIO_CONFIG, governance?: StudioGovernance) {
		this.config = config
		this.governance = governance ?? loadGovernance()
	}

	/** Test-only escape hatch to exercise the active path under vitest. */
	__setTestForceActive(v: boolean): void {
		this._testForceActive = v
	}

	/** Studio is "on" only when enabled AND not in a test run (unless forced). */
	isStudioActive(): boolean {
		return this._testForceActive || (this.config.enabled && !isTestEnv())
	}

	/** Whether a build intent in `message` should auto-trigger the department. */
	shouldAutoActivate(message: string): boolean {
		return this.isStudioActive() && this.config.autoActivate && isStudioBuildIntent(message)
	}

	setConfig(partial: Partial<StudioConfig>): void {
		this.config = { ...this.config, ...partial }
	}

	applyAdmin(input: string): void {
		this.governance = applyAdminDirective(this.governance, input)
	}

	/** The compressed PRD block appended to the system prompt when active. */
	buildPrdInjection(): string {
		return STUDIO_PRD_COMPRESSED
	}

	detectIntent(message: string): StudioIntent {
		return detectStudioIntent(message)
	}

	planBuild(intent: StudioIntent): DepartmentPlan {
		return planDepartment(intent, this.governance)
	}

	generateTokens(opts: GenerateTokensOptions = {}): DesignTokens {
		return generateDesignTokens({
			baseColor: opts.baseColor,
			mood: opts.mood ?? this.config.aesthetic,
			platform: opts.platform ?? this.config.defaultPlatform,
			intensity: opts.intensity ?? this.config.intensity,
		})
	}

	runCurator(
		run: StudioRunResult,
	): Promise<{ assets: import('./types.js').StudioAsset[]; persisted: number }> {
		return curatorRun(run)
	}
}

// Convenience singleton (mirrors getEvolutionEngine / resetEvolutionEngine).
let _instance: StudioEngine | null = null

export function getStudioEngine(config?: StudioConfig): StudioEngine {
	if (!_instance) _instance = new StudioEngine(config ?? DEFAULT_STUDIO_CONFIG)
	return _instance
}

export function resetStudioEngine(): void {
	_instance = null
}

/** Module-level active check for callers that don't want to hold the engine. */
export function isStudioActive(): boolean {
	return getStudioEngine().isStudioActive()
}
