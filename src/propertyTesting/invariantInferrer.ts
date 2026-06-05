/**
 * Invariant Inferrer — analyzes function signatures and code to
 * automatically infer properties that should hold.
 *
 * Detects: commutativity, associativity, idempotency, identity elements,
 * bounds preservation, purity, and invertibility.
 */

import type { Arbitrary, InferredProperty, Property } from './types.js'
import * as arb from './arbitraries.js'

/**
 * Extract function signatures from code.
 * Returns array of { name, params: [{name, type}] }
 */
export function extractFunctionSignatures(code: string): Array<{
	name: string
	params: Array<{ name: string; type: string }>
	returnType: string
	body: string
}> {
	const functions: Array<{
		name: string
		params: Array<{ name: string; type: string }>
		returnType: string
		body: string
	}> = []

	// Match: function name(params): returnType { body }
	const fnPattern = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)\s*(?::\s*(\w+))?\s*\{([^}]*)\}/g
	let match: RegExpExecArray | null

	while ((match = fnPattern.exec(code)) !== null) {
		const name = match[1]
		const paramsStr = match[2]
		const returnType = match[3] ?? 'unknown'
		const body = match[4]

		const params = paramsStr
			.split(',')
			.filter((p: string) => p.trim().length > 0)
			.map((p: string) => {
				const parts = p.trim().split(':')
				return {
					name: parts[0].trim(),
					type: parts.length > 1 ? parts[1].trim() : 'unknown',
				}
			})

		functions.push({ name, params, returnType, body })
	}

	return functions
}

/**
 * Determine the appropriate arbitrary for a type annotation.
 */
function arbitraryForType(type: string): Arbitrary<unknown> {
	switch (type) {
		case 'number':
			return arb.integer()
		case 'string':
			return arb.string()
		case 'boolean':
			return arb.boolean
		default:
			return arb.integer()
	}
}

/**
 * Check if a function body appears to be a binary operation (takes 2 params of same type).
 */
function isBinaryOp(fn: { params: Array<{ name: string; type: string }>; returnType: string }): boolean {
	return fn.params.length === 2 &&
		fn.params[0].type === fn.params[1].type &&
		fn.params[0].type !== 'unknown'
}

/**
 * Check if a function body appears to be a unary operation.
 */
function isUnaryOp(fn: { params: Array<{ name: string; type: string }> }): boolean {
	return fn.params.length === 1
}

/**
 * Infer properties from a function signature and body.
 */
export function inferProperties(
	fn: {
		name: string
		params: Array<{ name: string; type: string }>
		returnType: string
		body: string
	},
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	fnImpl?: (...args: any[]) => any,
): InferredProperty[] {
	const properties: InferredProperty[] = []

	if (!fnImpl) return properties

	const paramType = fn.params[0]?.type ?? 'unknown'
	const arbForType = arbitraryForType(paramType)

	// 1. Commutativity: f(a, b) === f(b, a)
	if (isBinaryOp(fn) && fn.returnType === paramType) {
		properties.push({
			name: `${fn.name} commutativity`,
			kind: 'commutative',
			confidence: 0.6,
			description: `${fn.name}(a, b) === ${fn.name}(b, a) for all a, b`,
			property: {
				name: `${fn.name} commutativity`,
				arbitrary: arb.tuple(arbForType, arbForType) as Arbitrary<unknown>,
				predicate: (input: unknown) => {
					const [a, b] = input as [unknown, unknown]
					const ab = fnImpl(a, b)
					const ba = fnImpl(b, a)
					return JSON.stringify(ab) === JSON.stringify(ba)
				},
			},
		})
	}

	// 2. Idempotency: f(f(x)) === f(x)
	if (isUnaryOp(fn) && fn.returnType === paramType) {
		properties.push({
			name: `${fn.name} idempotency`,
			kind: 'idempotent',
			confidence: 0.7,
			description: `${fn.name}(${fn.name}(x)) === ${fn.name}(x) for all x`,
			property: {
				name: `${fn.name} idempotency`,
				arbitrary: arbForType,
				predicate: (input: unknown) => {
					const fx = fnImpl(input)
					const ffx = fnImpl(fx)
					return JSON.stringify(fx) === JSON.stringify(ffx)
				},
			},
		})
	}

	// 3. Identity element: f(x, identity) === x
	if (isBinaryOp(fn) && fn.returnType === paramType) {
		properties.push({
			name: `${fn.name} identity check`,
			kind: 'identity',
			confidence: 0.5,
			description: `${fn.name}(x, identity) === x for some identity value`,
			property: {
				name: `${fn.name} identity (0)`,
				arbitrary: arbForType,
				predicate: (input: unknown) => {
					const result = fnImpl(input, 0)
					return JSON.stringify(result) === JSON.stringify(input)
				},
			},
		})
	}

	// 4. Purity: f(x) always returns the same value for the same input
	if (isUnaryOp(fn)) {
		properties.push({
			name: `${fn.name} purity`,
			kind: 'pure',
			confidence: 0.8,
			description: `${fn.name}(x) returns the same value on repeated calls`,
			property: {
				name: `${fn.name} purity`,
				arbitrary: arbForType,
				predicate: (input: unknown) => {
					const r1 = fnImpl(input)
					const r2 = fnImpl(input)
					const r3 = fnImpl(input)
					return JSON.stringify(r1) === JSON.stringify(r2) &&
						JSON.stringify(r2) === JSON.stringify(r3)
				},
			},
		})
	}

	// 5. Bounds: numeric results stay within reasonable range
	if (fn.returnType === 'number') {
		properties.push({
			name: `${fn.name} bounds`,
			kind: 'bounds',
			confidence: 0.7,
			description: `${fn.name} returns finite numbers (not NaN, not Infinity)`,
			property: {
				name: `${fn.name} bounds`,
				arbitrary: arbForType,
				predicate: (input: unknown) => {
					const result = fn.params.length === 2
						? fnImpl(input, 0)
						: fnImpl(input)
					return typeof result === 'number' && Number.isFinite(result) && !Number.isNaN(result)
				},
			},
		})
	}

	return properties
}

/**
 * Analyze code and infer all testable properties.
 */
export function analyzeCodeForProperties(
	code: string,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	fnImpls?: Map<string, (...args: any[]) => any>,
): InferredProperty[] {
	const signatures = extractFunctionSignatures(code)
	const allProperties: InferredProperty[] = []

	for (const fn of signatures) {
		const fnImpl = fnImpls?.get(fn.name)
		const props = inferProperties(fn, fnImpl)
		allProperties.push(...props)
	}

	return allProperties
}
