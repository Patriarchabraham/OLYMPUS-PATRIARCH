import { getIsNonInteractiveSession } from '../../bootstrap/state.js'
import { isOpsActive } from '../../ops/opsEngine.js'
import { getFeatureValue_CACHED_MAY_BE_STALE } from '../../services/analytics/growthbook.js'
import { isStudioActive } from '../../studio/studioEngine.js'
import { isEnvTruthy } from '../../utils/envUtils.js'
import { ARCHITECT_AGENT } from './built-in/architectAgent.js'
import { CLAUDE_CODE_GUIDE_AGENT } from './built-in/claudeCodeGuideAgent.js'
import { DATA_ANALYST_AGENT } from './built-in/dataAnalystAgent.js'
import { EXPLORE_AGENT } from './built-in/exploreAgent.js'
import { GENERAL_PURPOSE_AGENT } from './built-in/generalPurposeAgent.js'
import { OPS_AGENTS } from './built-in/opsAgents.js'
import { PLAN_AGENT } from './built-in/planAgent.js'
import { RESEARCHER_AGENT } from './built-in/researcherAgent.js'
import { REVIEWER_AGENT } from './built-in/reviewerAgent.js'
import { STATUSLINE_SETUP_AGENT } from './built-in/statuslineSetup.js'
import { STUDIO_AGENTS } from './built-in/studioAgents.js'
import { TESTER_AGENT } from './built-in/testerAgent.js'
import { VERIFICATION_AGENT } from './built-in/verificationAgent.js'
import type { AgentDefinition } from './loadAgentsDir.js'

export function areExplorePlanAgentsEnabled(): boolean {
	if (true) {
		// 3P default: true — Bedrock/Vertex keep agents enabled (matches pre-experiment
		// external behavior). A/B test treatment sets false to measure impact of removal.
		return getFeatureValue_CACHED_MAY_BE_STALE('tengu_amber_stoat', true)
	}
	return false
}

export function getBuiltInAgents(): AgentDefinition[] {
	// Allow disabling all built-in agents via env var (useful for SDK users who want a blank slate)
	// Only applies in noninteractive mode (SDK/API usage)
	if (
		isEnvTruthy(process.env.CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS) &&
		getIsNonInteractiveSession()
	) {
		return []
	}

	// Use lazy require inside the function body to avoid circular dependency
	// issues at module init time. The coordinatorMode module depends on tools
	// which depend on AgentTool which imports this file.
	if (true) {
		if (isEnvTruthy(process.env.CLAUDE_CODE_COORDINATOR_MODE)) {
			/* eslint-disable @typescript-eslint/no-require-imports */
			const { getCoordinatorAgents } =
				require('../../coordinator/workerAgent.js') as typeof import('../../coordinator/workerAgent.js')
			/* eslint-enable @typescript-eslint/no-require-imports */
			return getCoordinatorAgents()
		}
	}

	const agents: AgentDefinition[] = [
		GENERAL_PURPOSE_AGENT,
		STATUSLINE_SETUP_AGENT,
		RESEARCHER_AGENT,
		ARCHITECT_AGENT,
		TESTER_AGENT,
		REVIEWER_AGENT,
		DATA_ANALYST_AGENT,
	]

	if (areExplorePlanAgentsEnabled()) {
		agents.push(EXPLORE_AGENT, PLAN_AGENT)
	}

	// Olympuz Studio specialists — only when Studio is active. Dormant under
	// vitest (isTestEnv) and when disabled, so existing agent-list snapshots stay
	// byte-for-byte stable. Studio agents are intentionally absent in coordinator mode.
	if (isStudioActive()) {
		agents.push(...STUDIO_AGENTS)
	}

	// Olympuz Ops specialists — only when Ops is active. Ops is OPT-IN, so under
	// vitest + when disabled/opt-out these are absent, keeping agent-list
	// snapshots byte-for-byte stable.
	if (isOpsActive()) {
		agents.push(...OPS_AGENTS)
	}

	// Include Code Guide agent for non-SDK entrypoints
	const isNonSdkEntrypoint =
		process.env.CLAUDE_CODE_ENTRYPOINT !== 'sdk-ts' &&
		process.env.CLAUDE_CODE_ENTRYPOINT !== 'sdk-py' &&
		process.env.CLAUDE_CODE_ENTRYPOINT !== 'sdk-cli'

	if (isNonSdkEntrypoint) {
		agents.push(CLAUDE_CODE_GUIDE_AGENT)
	}

	if (true && getFeatureValue_CACHED_MAY_BE_STALE('tengu_hive_evidence', false)) {
		agents.push(VERIFICATION_AGENT)
	}

	return agents
}
