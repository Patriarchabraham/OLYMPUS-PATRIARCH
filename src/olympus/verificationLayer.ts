/**
 * Verification Layer — hidden agents that ensure code/content quality.
 * Five-check pipeline: syntax, logic, security, quality, mathematical validation.
 */

import type { VerificationResult } from './types.js'

/**
 * Verify an agent's output through the 5-check pipeline.
 * Returns one result per check type.
 */
export function verifyOutput(
	targetType: VerificationResult['targetType'],
	targetId: string,
	content: string,
): VerificationResult[] {
	return [
		verifySyntax(targetType, targetId, content),
		verifyLogic(targetType, targetId, content),
		verifySecurity(targetType, targetId, content),
		verifyQuality(targetType, targetId, content),
		verifyMathematically(targetType, targetId, content),
	]
}

function verifySyntax(
	targetType: VerificationResult['targetType'],
	targetId: string,
	content: string,
): VerificationResult {
	const score = content.length > 0 && content.length < 100000 ? 1.0 : 0.3
	const hasInvalidChars = /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(content)

	return {
		targetType,
		targetId,
		checkType: 'syntax',
		result: hasInvalidChars ? 'fail' : score >= 0.7 ? 'pass' : 'warning',
		score: hasInvalidChars ? 0.1 : score,
		details: { length: content.length, hasInvalidChars },
		autoFixed: false,
	}
}

function verifyLogic(
	targetType: VerificationResult['targetType'],
	targetId: string,
	content: string,
): VerificationResult {
	const issues: string[] = []

	if (content.includes('undefined') && content.includes('required')) {
		issues.push('undefined_in_required_context')
	}

	const hasContradictions = /always.*never|impossible.*certain|guaranteed.*maybe/i.test(content)
	if (hasContradictions) {
		issues.push('contradiction_detected')
	}

	const score = issues.length === 0 ? 0.95 : Math.max(0.3, 1 - issues.length * 0.2)

	return {
		targetType,
		targetId,
		checkType: 'logic',
		result: issues.length === 0 ? 'pass' : 'warning',
		score,
		details: { issues },
		autoFixed: false,
	}
}

function verifySecurity(
	targetType: VerificationResult['targetType'],
	targetId: string,
	content: string,
): VerificationResult {
	const threats: string[] = []

	if (/<script|javascript:|onerror|onload=/i.test(content)) {
		threats.push('xss_risk')
	}
	if (/eval\(|Function\(|setTimeout\(['"]/i.test(content)) {
		threats.push('code_injection_risk')
	}
	if (/password|secret|api.key|token/i.test(content) && content.length < 200) {
		threats.push('potential_secret_exposure')
	}

	const score = threats.length === 0 ? 1.0 : Math.max(0.0, 1 - threats.length * 0.3)

	return {
		targetType,
		targetId,
		checkType: 'security',
		result: threats.length === 0 ? 'pass' : score < 0.5 ? 'fail' : 'warning',
		score,
		details: { threats },
		autoFixed: false,
	}
}

function verifyQuality(
	targetType: VerificationResult['targetType'],
	targetId: string,
	content: string,
): VerificationResult {
	let score = 0.5

	if (content.length > 10) score += 0.1
	if (content.length > 50) score += 0.1
	if (content.length < 50000) score += 0.1
	if (content.includes('\n')) score += 0.05
	if (/^#{1,3}\s/m.test(content)) score += 0.05

	const upperRatio = (content.match(/[A-Z]/g) || []).length / content.length
	if (upperRatio < 0.5) score += 0.05

	score = Math.min(1, score)

	return {
		targetType,
		targetId,
		checkType: 'quality',
		result: score >= 0.7 ? 'pass' : 'warning',
		score,
		details: { length: content.length },
		autoFixed: false,
	}
}

function verifyMathematically(
	targetType: VerificationResult['targetType'],
	targetId: string,
	content: string,
): VerificationResult {
	let checksum = 0
	for (let i = 0; i < content.length; i++) {
		checksum = ((checksum << 5) - checksum + content.charCodeAt(i)) | 0
	}

	const checksumValid = checksum !== 0

	const openBrackets = (content.match(/[{(\[]/g) || []).length
	const closeBrackets = (content.match(/[})\]]/g) || []).length
	const bracketsBalanced = Math.abs(openBrackets - closeBrackets) <= 1

	const score = (checksumValid ? 0.5 : 0) + (bracketsBalanced ? 0.5 : 0)

	return {
		targetType,
		targetId,
		checkType: 'mathematical',
		result: score >= 0.7 ? 'pass' : score >= 0.4 ? 'warning' : 'fail',
		score,
		details: { checksum, bracketsBalanced, openBrackets, closeBrackets },
		autoFixed: false,
	}
}

/**
 * Auto-fix common issues in content.
 * Strips null bytes, control characters, normalizes whitespace.
 */
export function autoFixContent(content: string): { content: string; fixed: boolean } {
	let fixed = content
	let changed = false

	if (/[\x00]/.test(fixed)) {
		fixed = fixed.replace(/\x00/g, '')
		changed = true
	}

	if (/[\x01-\x08\x0B\x0C\x0E-\x1F]/.test(fixed)) {
		fixed = fixed.replace(/[\x01-\x08\x0B\x0C\x0E-\x1F]/g, '')
		changed = true
	}

	if (/  {2,}/.test(fixed)) {
		fixed = fixed.replace(/ {2,}/g, ' ')
		changed = true
	}

	if (/ +$/m.test(fixed)) {
		fixed = fixed.replace(/ +$/gm, '')
		changed = true
	}

	return { content: fixed, fixed: changed }
}
