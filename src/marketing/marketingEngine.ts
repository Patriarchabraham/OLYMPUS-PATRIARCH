/**
 * Olympuz Marketing & Growth — Engine (lazy singleton, mirrors Studio/Ops engines).
 *
 * Owns the MarketingConfig + governance and exposes the operations the rest of
 * the system needs: PRD injection text, intent detection, campaign planning,
 * and curation. The only stateful marketing module.
 *
 * Marketing is ENABLED by default (mirrors Studio): its PRD is appended to the
 * system prompt and it auto-activates on detected marketing intent. Safety lives
 * at the publish layer (every publish/send/post asks approval + is logged). As
 * with every department, `isMarketingActive()` is false under vitest regardless
 * of config, so the test suite's prompt + agent/tool snapshots stay stable.
 */

import { runMarketingCurator as curatorRun } from './curator.js'
import { planCampaign } from './department.js'
import { applyMarketingDirective, loadMarketingGovernance } from './governance.js'
import { detectMarketingIntent } from './intent.js'
import { MARKETING_PRD_COMPRESSED, MARKETING_PRD_VERSION } from './principles.js'
import type {
	CampaignPlan,
	MarketingConfig,
	MarketingGovernance,
	MarketingIntent,
	MarketingRunResult,
} from './types.js'

/** True under vitest / NODE_ENV=test. The single test-safety signal. */
export function isTestEnv(): boolean {
	return Boolean(process.env.VITEST) || process.env.NODE_ENV === 'test'
}

export const DEFAULT_MARKETING_CONFIG: MarketingConfig = {
	enabled: true,
	autoActivate: true,
	intensity: 'ultra',
	channels: [],
	publish: { approvalPolicy: 'ask-always', logging: true },
	prdVersion: MARKETING_PRD_VERSION,
}

/**
 * Resolve whether Marketing is enabled. `OLYMPUZ_MARKETING_ENABLED` env wins when
 * set ('true'/'1' → on, anything else → off — a hard kill switch); otherwise the
 * persisted config decides. Exported for direct testability.
 */
export function resolveMarketingEnabled(config: MarketingConfig): boolean {
	const env = process.env.OLYMPUZ_MARKETING_ENABLED
	if (env !== undefined) return env === 'true' || env === '1'
	return config.enabled
}

/**
 * `OLYMPUZ_MARKETING_ENABLED`, when set to anything but 'true'/'1', is a HARD
 * kill switch for the whole department — wins over config AND the test
 * force-active hatch. Exported for direct testability.
 */
export function isMarketingKillSwitchOn(): boolean {
	const env = process.env.OLYMPUZ_MARKETING_ENABLED
	return env !== undefined && env !== 'true' && env !== '1'
}

export class MarketingEngine {
	config: MarketingConfig
	governance: MarketingGovernance
	private _testForceActive = false

	constructor(
		config: MarketingConfig = DEFAULT_MARKETING_CONFIG,
		governance?: MarketingGovernance,
	) {
		this.config = config
		this.governance = governance ?? loadMarketingGovernance()
	}

	/** Test-only escape hatch to exercise the active path under vitest. */
	__setTestForceActive(v: boolean): void {
		this._testForceActive = v
	}

	/** Marketing is "on" when the kill switch is off AND (forced OR (enabled AND not test)). */
	isMarketingActive(): boolean {
		if (isMarketingKillSwitchOn()) return false
		return this._testForceActive || (resolveMarketingEnabled(this.config) && !isTestEnv())
	}

	/** Auto-activate on detected marketing intent (allowed for Marketing, unlike Ops). */
	shouldAutoActivate(message: string): boolean {
		if (!this.isMarketingActive()) return false
		return detectMarketingIntent(message).isMarketingRequest
	}

	setConfig(partial: Partial<MarketingConfig>): void {
		this.config = { ...this.config, ...partial }
	}

	applyAdmin(input: string): void {
		this.governance = applyMarketingDirective(this.governance, input)
	}

	/** The compressed PRD block appended to the system prompt when active. */
	buildPrdInjection(): string {
		return MARKETING_PRD_COMPRESSED
	}

	detectIntent(message: string): MarketingIntent {
		return detectMarketingIntent(message)
	}

	planCampaign(intent: MarketingIntent): CampaignPlan {
		return planCampaign(intent, this.governance)
	}

	runMarketingCurator(
		run: MarketingRunResult,
	): Promise<{ assets: import('./types.js').MarketingAsset[]; persisted: number }> {
		return curatorRun(run)
	}
}

// Convenience singleton (mirrors getStudioEngine / getOpsEngine).
let _instance: MarketingEngine | null = null

export function getMarketingEngine(config?: MarketingConfig): MarketingEngine {
	if (!_instance) _instance = new MarketingEngine(config ?? DEFAULT_MARKETING_CONFIG)
	return _instance
}

export function resetMarketingEngine(): void {
	_instance = null
}

/** Module-level active check for callers that don't want to hold the engine. */
export function isMarketingActive(): boolean {
	return getMarketingEngine().isMarketingActive()
}
