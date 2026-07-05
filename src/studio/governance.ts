/**
 * Olympuz Studio — Governance / admin hierarchy.
 *
 * The user asked for "admin over everything (incl. effects), general admin, and
 * admin of admins." This module encodes that:
 *
 *   Director (admin of admins)  >  Domain admin  >  default
 *
 * A domain admin (design/effects/copy/ux/web/android/windows/qa) holds policies
 * for its area. The Director can override ANY domain policy. Conflict resolution
 * is deterministic: Director wins.
 *
 * Pure, no I/O. Tested directly.
 */

import {
	type PolicyValue,
	STUDIO_DOMAINS,
	type StudioDomain,
	type StudioGovernance,
} from './types.js'

export function loadGovernance(partial?: Partial<StudioGovernance>): StudioGovernance {
	return {
		director: { policies: { ...(partial?.director?.policies ?? {}) } },
		admins: { ...(partial?.admins ?? {}) },
	}
}

/**
 * Resolve a policy by precedence: Director override > Domain admin > undefined.
 * Director overrides are namespaced as `${domain}.${key}`.
 */
export function resolvePolicy(
	gov: StudioGovernance,
	domain: StudioDomain,
	key: string,
): PolicyValue | undefined {
	const directorKey = `${domain}.${key}`
	if (directorKey in gov.director.policies) return gov.director.policies[directorKey]
	return gov.admins[domain]?.policies[key]
}

export interface ParsedDirective {
	level: 'director' | 'domain'
	domain: StudioDomain
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
 * Parse a CLI/admin directive of the form:
 *   "<domain>.<key>=<value>"                 -> domain policy
 *   "director.<domain>.<key>=<value>"        -> Director override
 * value is coerced: true/false -> bool, integer -> number, comma-list -> string[].
 * Returns null when the domain is unknown or the shape is invalid.
 */
export function parseAdminDirective(input: string): ParsedDirective | null {
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

	if (!STUDIO_DOMAINS.includes(domain as StudioDomain)) return null
	return { level, domain: domain as StudioDomain, key, value }
}

/** Apply a parsed directive to a governance object, immutably. */
export function setPolicyFromDirective(
	gov: StudioGovernance,
	directive: ParsedDirective,
): StudioGovernance {
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

/** Convenience: parse + apply in one step. Returns the original gov on parse failure. */
export function applyAdminDirective(gov: StudioGovernance, input: string): StudioGovernance {
	const parsed = parseAdminDirective(input)
	if (!parsed) return gov
	return setPolicyFromDirective(gov, parsed)
}

/** Well-known governance keys the department plan respects. */
const KNOWN_POLICY_KEYS: Record<StudioDomain, string[]> = {
	design: ['maxFontFamilies', 'requiredContrast', 'aesthetic'],
	effects: ['requiredLibs', 'allowMotion', 'minLayeredFamilies'],
	copy: ['voice', 'maxCtaPerView'],
	ux: ['requireFlows', 'accessibilityLevel'],
	web: ['stack', 'fonts'],
	android: ['stack', 'minSdk'],
	windows: ['stack', 'packaging', 'dpiAware'],
	qa: ['requireBuild', 'requireA11yAudit'],
}

/**
 * Collect the resolved governance notes for a plan — the directives the
 * delegation must honor. Deterministic ordering by domain then key.
 */
export function governanceNotes(gov: StudioGovernance): string[] {
	const notes: string[] = []
	for (const domain of STUDIO_DOMAINS) {
		for (const key of KNOWN_POLICY_KEYS[domain]) {
			const value = resolvePolicy(gov, domain, key)
			if (value !== undefined) {
				const origin = `${domain}.${key}` in gov.director.policies ? 'director' : 'admin'
				const valStr = Array.isArray(value) ? value.join('|') : String(value)
				notes.push(`[${origin}] ${domain}.${key} = ${valStr}`)
			}
		}
	}
	return notes
}
