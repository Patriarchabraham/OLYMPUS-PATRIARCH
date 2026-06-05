import { describe, it, expect } from 'vitest'
import { PropertyRunner } from '../propertyRunner.js'
import * as arb from '../arbitraries.js'
import { extractFunctionSignatures, inferProperties } from '../invariantInferrer.js'

describe('Arbitraries', () => {
	it('integer generates values in range', () => {
		const int = arb.integer(0, 100)
		for (let seed = 1; seed <= 50; seed++) {
			const gen = int.generate(seed, 10)
			expect(gen.value).toBeGreaterThanOrEqual(0)
			expect(gen.value).toBeLessThanOrEqual(100)
		}
	})

	it('float generates values in range', () => {
		const f = arb.float(0, 1)
		for (let seed = 1; seed <= 50; seed++) {
			const gen = f.generate(seed, 10)
			expect(gen.value).toBeGreaterThanOrEqual(0)
			expect(gen.value).toBeLessThanOrEqual(1)
		}
	})

	it('boolean generates both true and false', () => {
		const trues = new Set()
		const falses = new Set()
		for (let seed = 1; seed <= 20; seed++) {
			const gen = arb.boolean.generate(seed, 1)
			if (gen.value) trues.add(seed)
			else falses.add(seed)
		}
		expect(trues.size).toBeGreaterThan(0)
		expect(falses.size).toBeGreaterThan(0)
	})

	it('string generates strings with correct max length', () => {
		const s = arb.string(10)
		for (let seed = 1; seed <= 50; seed++) {
			const gen = s.generate(seed, 20)
			expect(gen.value.length).toBeLessThanOrEqual(10)
		}
	})

	it('array generates arrays with correct max length', () => {
		const arr = arb.array(arb.integer(0, 10), 5)
		for (let seed = 1; seed <= 50; seed++) {
			const gen = arr.generate(seed, 10)
			expect(gen.value.length).toBeLessThanOrEqual(5)
			for (const v of gen.value) {
				expect(v).toBeGreaterThanOrEqual(0)
				expect(v).toBeLessThanOrEqual(10)
			}
		}
	})

	it('constant always returns the same value', () => {
		const c = arb.constant(42)
		for (let seed = 1; seed <= 10; seed++) {
			expect(c.generate(seed, 1).value).toBe(42)
		}
	})

	it('oneof picks from different arbitraries', () => {
		const one = arb.oneof(arb.constant(1), arb.constant(2), arb.constant(3))
		const values = new Set<number>()
		for (let seed = 1; seed <= 30; seed++) {
			values.add(one.generate(seed, 1).value)
		}
		expect(values.size).toBeGreaterThanOrEqual(2)
	})

	it('tuple generates tuples of correct length', () => {
		const t = arb.tuple(arb.integer(), arb.string(5))
		for (let seed = 1; seed <= 10; seed++) {
			const gen = t.generate(seed, 10)
			expect(Array.isArray(gen.value)).toBe(true)
			expect(gen.value.length).toBe(2)
			expect(typeof gen.value[0]).toBe('number')
			expect(typeof gen.value[1]).toBe('string')
		}
	})

	it('integer shrinks toward 0', () => {
		const int = arb.integer(0, 100)
		const shrinks = int.shrink(50)
		expect(shrinks).toContain(0)
		expect(shrinks).toContain(25)
	})

	it('string shrinks toward empty', () => {
		const s = arb.string(20)
		const shrinks = s.shrink('hello')
		expect(shrinks).toContain('')
	})

	it('array shrinks toward empty', () => {
		const arr = arb.array(arb.integer())
		const shrinks = arr.shrink([1, 2, 3, 4, 5])
		expect(shrinks.some((s) => s.length === 0)).toBe(true)
	})
})

describe('PropertyRunner', () => {
	it('passes a property that always holds', () => {
		const runner = new PropertyRunner({ numTests: 100 })
		const result = runner.check(
			'integer addition is commutative',
			arb.tuple(arb.integer(-100, 100), arb.integer(-100, 100)),
			(pair) => {
				const [a, b] = pair as [number, number]
				return a + b === b + a
			},
		)
		expect(result.passed).toBe(true)
		expect(result.testsRun).toBe(100)
	})

	it('fails a property that does not hold', () => {
		const runner = new PropertyRunner({ numTests: 1000, seed: 42 })
		const result = runner.check(
			'x^2 > x for all x',
			arb.integer(-100, 100),
			(x) => x * x > x,
		)
		expect(result.passed).toBe(false)
		expect(result.counterexample).toBeDefined()
	})

	it('finds and shrinks counterexample', () => {
		const runner = new PropertyRunner({ numTests: 1000, seed: 42 })
		const result = runner.check(
			'always positive',
			arb.integer(-100, 100),
			(x) => x > 0,
		)
		expect(result.passed).toBe(false)
		expect(result.minimalCounterexample).toBeDefined()
		// Minimal counterexample should be 0 or 1 (smallest non-positive)
		const minimal = result.minimalCounterexample as number
		expect(minimal).toBeLessThanOrEqual(0)
	})

	it('catches exceptions as failures', () => {
		const runner = new PropertyRunner({ numTests: 100 })
		const result = runner.check(
			'throws on negative',
			arb.integer(-10, 10),
			(x) => {
				if (x < 0) throw new Error('negative!')
				return true
			},
		)
		expect(result.passed).toBe(false)
		expect(result.error).toContain('negative')
	})

	it('runAll returns correct summary', () => {
		const runner = new PropertyRunner({ numTests: 50 })
		const summary = runner.runAll([
			{
				name: 'commutative add',
				arbitrary: arb.tuple(arb.integer(), arb.integer()),
				predicate: (p) => { const [a, b] = p as [number, number]; return a + b === b + a },
			},
			{
				name: 'always positive',
				arbitrary: arb.integer(-10, 10),
				predicate: (x) => (x as number) > 0,
			},
		])
		expect(summary.totalProperties).toBe(2)
		expect(summary.passed).toBe(1)
		expect(summary.failed).toBe(1)
	})
})

describe('InvariantInferrer', () => {
	it('extracts function signatures', () => {
		const code = `
			function add(a: number, b: number): number {
				return a + b
			}
			function greet(name: string): string {
				return 'Hello ' + name
			}
		`
		const sigs = extractFunctionSignatures(code)
		expect(sigs.length).toBe(2)
		expect(sigs[0].name).toBe('add')
		expect(sigs[0].params.length).toBe(2)
		expect(sigs[1].name).toBe('greet')
	})

	it('infers commutativity for binary ops', () => {
		const add = (a: number, b: number) => a + b
		const props = inferProperties(
			{ name: 'add', params: [{ name: 'a', type: 'number' }, { name: 'b', type: 'number' }], returnType: 'number', body: 'return a + b' },
			add,
		)
		const commutative = props.find((p) => p.kind === 'commutative')
		expect(commutative).toBeDefined()
		expect(commutative?.name).toContain('commutativity')
	})

	it('infers idempotency for unary ops', () => {
		const abs = (x: number) => Math.abs(x)
		const props = inferProperties(
			{ name: 'abs', params: [{ name: 'x', type: 'number' }], returnType: 'number', body: 'return Math.abs(x)' },
			abs,
		)
		const idempotent = props.find((p) => p.kind === 'idempotent')
		expect(idempotent).toBeDefined()
	})

	it('infers purity', () => {
		const double = (x: number) => x * 2
		const props = inferProperties(
			{ name: 'double', params: [{ name: 'x', type: 'number' }], returnType: 'number', body: 'return x * 2' },
			double,
		)
		const purity = props.find((p) => p.kind === 'pure')
		expect(purity).toBeDefined()
	})

	it('infers bounds for numeric functions', () => {
		const add = (a: number, b: number) => a + b
		const props = inferProperties(
			{ name: 'add', params: [{ name: 'a', type: 'number' }, { name: 'b', type: 'number' }], returnType: 'number', body: 'return a + b' },
			add,
		)
		const bounds = props.find((p) => p.kind === 'bounds')
		expect(bounds).toBeDefined()
	})

	it('returns empty for functions without implementation', () => {
		const props = inferProperties(
			{ name: 'mystery', params: [{ name: 'x', type: 'number' }], returnType: 'number', body: 'return x' },
			undefined,
		)
		expect(props.length).toBe(0)
	})
})
