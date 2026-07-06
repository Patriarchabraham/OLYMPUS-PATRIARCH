/**
 * Olympuz Marketing & Growth — Governance (admin hierarchy).
 *
 * Director (admin of admins) > domain admin > default. Set policy via
 * /marketing admin set <domain>.<key>=<value> (or director.<domain>.<key>=…).
 * Pure — load/resolve/parse/apply + a notes renderer. No I/O.
 */

import type { MarketingDomain, MarketingGovernance, PolicyValue } from './types.js'

/** Well-known policy keys per domain (used to validate + to render defaults). */
export const KNOWN_MARKETING_POLICY_KEYS: Record<MarketingDomain, string[]> = {
	strategy: ['objectives', 'positioning', 'budget'],
	copy: ['voice', 'pillars', 'bannedTerms'],
	design: ['system', 'logoUse', 'palette'],
	video: ['defaultProvider', 'maxDurationSec', 'captioned'],
	social: ['channels', 'cadence', 'responseSLAmin'],
	email: ['doubleOptIn', 'unsubscribe', 'segments'],
	analytics: ['kpis', 'attributionWindowDays'],
	publish: ['approvalPolicy', 'logging', 'reversible'],
}

/** A fresh governance with no overrides (all defaults in effect). */
export function loadMarketingGovernance(): MarketingGovernance {
	return { director: { policies: {} }, admins: {} }
}

/** Resolve a policy: Director > domain admin > undefined. */
export function resolveMarketingPolicy(
	gov: MarketingGovernance,
	domain: MarketingDomain,
	key: string,
): PolicyValue | undefined {
	const dirKey = `${domain}.${key}`
	if (gov.director.policies[dirKey] !== undefined) {
		return gov.director.policies[dirKey]
	}
	const admin = gov.admins[domain]
	if (admin?.policies[key] !== undefined) return admin.policies[key]
	return undefined
}

/** Parse a value into bool / int / comma-list / string. */
function parseValue(raw: string): PolicyValue {
	const trimmed = raw.trim()
	if (trimmed === 'true') return true
	if (trimmed === 'false') return false
	if (/^-?\d+$/.test(trimmed)) return Number.parseInt(trimmed, 10)
	if (trimmed.includes(','))
		return trimmed
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean)
	return trimmed
}

export interface ParsedMarketingDirective {
	domain: MarketingDomain
	key: string
	value: PolicyValue
	isDirector: boolean
}

/** Parse 'domain.key=value' or 'director.domain.key=value'. Null if unknown domain/key. */
export function parseMarketingDirective(directive: string): ParsedMarketingDirective | null {
	const eq = directive.indexOf('=')
	if (eq < 0) return null
	const left = directive.slice(0, eq).trim()
	const valueRaw = directive.slice(eq + 1)
	const parts = left.split('.')
	let isDirector = false
	let domainStr: string
	let key: string
	if (parts.length === 3 && parts[0] === 'director') {
		isDirector = true
		domainStr = parts[1]!
		key = parts[2]!
	} else if (parts.length === 2) {
		domainStr = parts[0]!
		key = parts[1]!
	} else {
		return null
	}
	const known = KNOWN_MARKETING_POLICY_KEYS[domainStr as MarketingDomain]
	if (!known?.includes(key)) return null
	return {
		domain: domainStr as MarketingDomain,
		key,
		value: parseValue(valueRaw),
		isDirector,
	}
}

/** Set a domain-admin policy on a governance (immutable). */
export function setMarketingPolicyFromDirective(
	gov: MarketingGovernance,
	directive: string,
): MarketingGovernance {
	const parsed = parseMarketingDirective(directive)
	if (!parsed) return gov
	if (parsed.isDirector) {
		return {
			...gov,
			director: {
				policies: {
					...gov.director.policies,
					[`${parsed.domain}.${parsed.key}`]: parsed.value,
				},
			},
		}
	}
	const existing = gov.admins[parsed.domain]
	return {
		...gov,
		admins: {
			...gov.admins,
			[parsed.domain]: {
				domain: parsed.domain,
				policies: { ...(existing?.policies ?? {}), [parsed.key]: parsed.value },
			},
		},
	}
}

/** Apply a directive to the governance object (convenience for the engine). */
export function applyMarketingDirective(
	gov: MarketingGovernance,
	directive: string,
): MarketingGovernance {
	return setMarketingPolicyFromDirective(gov, directive)
}

function fmt(value: PolicyValue): string {
	return Array.isArray(value) ? value.join('|') : String(value)
}

/** Human-readable resolved-policy notes (for delegation instructions + /marketing admin list). */
export function marketingGovernanceNotes(gov: MarketingGovernance): string[] {
	const notes: string[] = []
	for (const [domainStr, keys] of Object.entries(KNOWN_MARKETING_POLICY_KEYS)) {
		const domain = domainStr as MarketingDomain
		for (const key of keys) {
			const value = resolveMarketingPolicy(gov, domain, key)
			if (value === undefined) continue
			const dirKey = `${domain}.${key}`
			const isDirector = gov.director.policies[dirKey] !== undefined
			notes.push(
				isDirector
					? `[director] ${domain}.${key} = ${fmt(value)}`
					: `${domain}.${key} = ${fmt(value)}`,
			)
		}
	}
	return notes
}
