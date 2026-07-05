/**
 * Olympuz Agentic Operations — Engine (lazy singleton, mirrors StudioEngine).
 *
 * Owns the OpsConfig + governance and exposes the operations the rest of the
 * system needs: PRD injection text, intent detection, ops planning, and
 * curation. The only stateful ops module.
 *
 * Test-safety + safety keystone: `isOpsActive()` is false whenever `isTestEnv()`
 * is true, regardless of config — AND Ops is OPT-IN by default (enabled: false),
 * so real computer/browser control never activates unless the user runs
 * `/ops enable` (or sets OLYMPUZ_OPS_ENABLED). Destructive actions are gated
 * separately at the tool layer.
 */

import { runOpsCurator as curatorRun } from './curator.js'
import { planOpsDepartment } from './department.js'
import { applyOpsDirective, loadOpsGovernance } from './governance.js'
import { detectOpsIntent } from './intent.js'
import { OPS_PRD_COMPRESSED, OPS_PRD_VERSION } from './principles.js'
import type { OpsConfig, OpsGovernance, OpsIntent, OpsPlan, OpsRunResult } from './types.js'

/** True under vitest / NODE_ENV=test. The single test-safety signal. */
export function isTestEnv(): boolean {
	return Boolean(process.env.VITEST) || process.env.NODE_ENV === 'test'
}

export const DEFAULT_OPS_CONFIG: OpsConfig = {
	enabled: false,
	autoActivate: false,
	intensity: 'ultra',
	surfaces: [],
	approvalPolicy: 'ask-destructive',
	prdVersion: OPS_PRD_VERSION,
}

/**
 * Resolve whether Ops is enabled. `OLYMPUZ_OPS_ENABLED` env wins when set
 * ('true'/'1' → on, anything else → off — a hard kill switch); otherwise the
 * persisted config decides. Exported for direct testability (independent of
 * `isTestEnv()`).
 */
export function resolveEnabled(config: OpsConfig): boolean {
	const env = process.env.OLYMPUZ_OPS_ENABLED
	if (env !== undefined) return env === 'true' || env === '1'
	return config.enabled
}

/**
 * `OLYMPUZ_OPS_ENABLED`, when set to anything but 'true'/'1', is a HARD kill
 * switch for the whole department — it wins over the config AND over the test
 * force-active escape hatch. Exported for direct testability.
 */
export function isOpsKillSwitchOn(): boolean {
	const env = process.env.OLYMPUZ_OPS_ENABLED
	return env !== undefined && env !== 'true' && env !== '1'
}

export class OpsEngine {
	config: OpsConfig
	governance: OpsGovernance
	private _testForceActive = false

	constructor(config: OpsConfig = DEFAULT_OPS_CONFIG, governance?: OpsGovernance) {
		this.config = config
		this.governance = governance ?? loadOpsGovernance()
	}

	/** Test-only escape hatch to exercise the active path under vitest. */
	__setTestForceActive(v: boolean): void {
		this._testForceActive = v
	}

	/** Ops is "on" only when the kill switch is off AND (forced OR (enabled AND not in a test run)). */
	isOpsActive(): boolean {
		// HARD kill switch is absolute — wins even over the test force-active hatch.
		if (isOpsKillSwitchOn()) return false
		return this._testForceActive || (resolveEnabled(this.config) && !isTestEnv())
	}

	/** Ops never auto-activates on intent — explicit opt-in only. */
	shouldAutoActivate(_message: string): boolean {
		return false
	}

	setConfig(partial: Partial<OpsConfig>): void {
		this.config = { ...this.config, ...partial }
	}

	applyAdmin(input: string): void {
		this.governance = applyOpsDirective(this.governance, input)
	}

	/** The compressed PRD block appended to the system prompt when active. */
	buildPrdInjection(): string {
		return OPS_PRD_COMPRESSED
	}

	detectIntent(message: string): OpsIntent {
		return detectOpsIntent(message)
	}

	planOps(intent: OpsIntent): OpsPlan {
		return planOpsDepartment(intent, this.governance)
	}

	runOpsCurator(
		run: OpsRunResult,
	): Promise<{ assets: import('./types.js').OpsAsset[]; persisted: number }> {
		return curatorRun(run)
	}
}

// Convenience singleton (mirrors getStudioEngine / resetStudioEngine).
let _instance: OpsEngine | null = null

export function getOpsEngine(config?: OpsConfig): OpsEngine {
	if (!_instance) _instance = new OpsEngine(config ?? DEFAULT_OPS_CONFIG)
	return _instance
}

export function resetOpsEngine(): void {
	_instance = null
}

/** Module-level active check for callers that don't want to hold the engine. */
export function isOpsActive(): boolean {
	return getOpsEngine().isOpsActive()
}
