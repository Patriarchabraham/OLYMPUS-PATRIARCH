/**
 * Olympuz Agentic Operations — Governance / admin hierarchy.
 *
 * Mirrors src/studio/governance.ts. Director (admin of admins) > domain admin >
 * default. Domains: computer/browser/vision/voice/automation/teams. Pure, no I/O.
 */

import { OPS_DOMAINS, type OpsDomain, type OpsGovernance, type PolicyValue } from './types.js'

export function loadOpsGovernance(partial?: Partial<OpsGovernance>): OpsGovernance {
	return {
		director: { policies: { ...(partial?.director?.policies ?? {}) } },
		admins: { ...(partial?.admins ?? {}) },
	}
}

/** Resolve a policy by precedence: Director override > Domain admin > undefined. */
export function resolveOpsPolicy(
	gov: OpsGovernance,
	domain: OpsDomain,
	key: string,
): PolicyValue | undefined {
	const directorKey = `${domain}.${key}`
	if (directorKey in gov.director.policies) return gov.director.policies[directorKey]
	return gov.admins[domain]?.policies[key]
}

export interface OpsParsedDirective {
	level: 'director' | 'domain'
	domain: OpsDomain
	key: string
	value: PolicyValue
}

function parseValue(raw: string): PolicyValue {
	const trimmed = raw.trim()
	if (trimmed === 'true') return true
	if (trimmed === 'false') return false
	if (/^-?\d+$/.test(trimmed)) return Number(trimmed)
	if (trimmed.includes(','))
		return trimmed
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean)
	return trimmed
}

/**
 * Parse "<domain>.<key>=<value>" (domain policy) or "director.<domain>.<key>=<value>"
 * (Director override). Value coerced: bool / int / comma-list / string.
 * Returns null when the domain is unknown or the shape is invalid.
 */
export function parseOpsDirective(input: string): OpsParsedDirective | null {
	const eq = input.indexOf('=')
	if (eq < 0) return null
	const path = input.slice(0, eq).trim()
	const value = parseValue(input.slice(eq + 1))
	const parts = path
		.split('.')
		.map((p) => p.trim())
		.filter(Boolean)
	if (parts.length < 2) return null

	let level: 'director' | 'domain'
	let domain: string
	let key: string
	if (parts[0] === 'director') {
		if (parts.length < 3) return null
		level = 'director'
		domain = parts[1]!
		key = parts.slice(2).join('.')
	} else {
		level = 'domain'
		domain = parts[0]!
		key = parts.slice(1).join('.')
	}

	if (!OPS_DOMAINS.includes(domain as OpsDomain)) return null
	return { level, domain: domain as OpsDomain, key, value }
}

export function setOpsPolicyFromDirective(
	gov: OpsGovernance,
	directive: OpsParsedDirective,
): OpsGovernance {
	if (directive.level === 'director') {
		return {
			...gov,
			director: {
				policies: {
					...gov.director.policies,
					[`${directive.domain}.${directive.key}`]: directive.value,
				},
			},
		}
	}
	const existing = gov.admins[directive.domain] ?? { domain: directive.domain, policies: {} }
	return {
		...gov,
		admins: {
			...gov.admins,
			[directive.domain]: {
				domain: directive.domain,
				policies: { ...existing.policies, [directive.key]: directive.value },
			},
		},
	}
}

/** Convenience: parse + apply. Returns the original gov on parse failure. */
export function applyOpsDirective(gov: OpsGovernance, input: string): OpsGovernance {
	const parsed = parseOpsDirective(input)
	if (!parsed) return gov
	return setOpsPolicyFromDirective(gov, parsed)
}

/** Well-known governance keys the ops plan respects. */
const KNOWN_POLICY_KEYS: Record<OpsDomain, string[]> = {
	computer: ['approvalPolicy', 'allowFileDelete', 'allowShell'],
	browser: ['scope', 'allowPayments', 'headless'],
	vision: ['model', 'compressToTokens'],
	voice: ['sttProvider', 'ttsProvider', 'language'],
	automation: ['maxSteps', 'maxConcurrency', 'failSafe'],
	teams: ['requireApproval', 'maxTeammates'],
}

/** Collect resolved governance notes for a plan, deterministic ordering. */
export function opsGovernanceNotes(gov: OpsGovernance): string[] {
	const notes: string[] = []
	for (const domain of OPS_DOMAINS) {
		for (const key of KNOWN_POLICY_KEYS[domain]) {
			const value = resolveOpsPolicy(gov, domain, key)
			if (value !== undefined) {
				const origin = `${domain}.${key}` in gov.director.policies ? 'director' : 'admin'
				const valStr = Array.isArray(value) ? value.join('|') : String(value)
				notes.push(`[${origin}] ${domain}.${key} = ${valStr}`)
			}
		}
	}
	return notes
}
