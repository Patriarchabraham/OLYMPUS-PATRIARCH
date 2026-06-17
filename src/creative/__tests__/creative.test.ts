import { describe, expect, it } from 'vitest'
import {
	checker,
	linearGradient,
	mulberry32,
	radialGradient,
	svgDocument,
	svgPolygon,
	svgStar,
	valueNoise,
} from '../generate.js'
import {
	add,
	clipPolygon,
	cross,
	cubicBezier,
	dot,
	identity,
	invert,
	length,
	multiply,
	normalize,
	Path,
	polygonArea,
	quadBezier,
	rotate,
	scale,
	transformPoint,
	vec,
} from '../vector.js'

describe('vector math', () => {
	it('add/scale/dot/cross/normalize', () => {
		expect(add(vec(1, 2), vec(3, 4))).toEqual(vec(4, 6))
		expect(scale(vec(2, 4), 0.5)).toEqual(vec(1, 2))
		expect(dot(vec(1, 0), vec(0, 1))).toBe(0)
		expect(cross(vec(1, 0), vec(0, 1))).toBe(1)
		expect(normalize(vec(3, 4))).toEqual(vec(0.6, 0.8))
		expect(length(vec(3, 4))).toBe(5)
	})

	it('bezier endpoints hit control anchors', () => {
		expect(quadBezier(vec(0, 0), vec(5, 5), vec(10, 0), 0)).toEqual(vec(0, 0))
		expect(quadBezier(vec(0, 0), vec(5, 5), vec(10, 0), 1)).toEqual(vec(10, 0))
		expect(cubicBezier(vec(0, 0), vec(1, 2), vec(3, 4), vec(5, 0), 1)).toEqual(vec(5, 0))
	})

	it('rotate(90°) maps (1,0) → (0,1); invert(m)·m = identity', () => {
		const r = rotate(Math.PI / 2)
		const p = transformPoint(r, vec(1, 0))
		expect(p.x).toBeCloseTo(0, 6)
		expect(p.y).toBeCloseTo(1, 6)
		const inv = invert(r)!
		const eye = multiply(inv, r)
		expect(eye.a).toBeCloseTo(1, 6)
		expect(eye.d).toBeCloseTo(1, 6)
		expect(eye.e).toBeCloseTo(0, 6)
	})
})

describe('Path', () => {
	it('builds, serializes to SVG, and transforms', () => {
		const p = Path.move(vec(0, 0)).lineTo(vec(10, 0)).lineTo(vec(10, 10)).close()
		expect(p.toSvg()).toBe('M0,0 L10,0 L10,10 Z')
		const moved = p.transform(multiply(identity(), { a: 1, b: 0, c: 0, d: 1, e: 5, f: 5 }))
		expect(moved.toSvg()).toContain('M5,5')
	})

	it('approximates length of a straight path', () => {
		const p = Path.move(vec(0, 0)).lineTo(vec(10, 0))
		expect(p.length()).toBe(10)
	})
})

describe('polygon ops', () => {
	it('unit square area = 1', () => {
		expect(polygonArea([vec(0, 0), vec(1, 0), vec(1, 1), vec(0, 1)])).toBeCloseTo(1, 6)
	})
	it('clipPolygon intersects two overlapping squares', () => {
		const a = [vec(0, 0), vec(4, 0), vec(4, 4), vec(0, 4)]
		const b = [vec(2, 2), vec(6, 2), vec(6, 6), vec(2, 6)]
		const clipped = clipPolygon(a, b)
		expect(clipped.length).toBeGreaterThan(2)
		expect(polygonArea(clipped)).toBeCloseTo(4, 5) // 2×2 overlap
	})
})

describe('generators', () => {
	it('linearGradient has correct dimensions and corner colors', () => {
		const g = linearGradient(4, 2, { r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 }, 0)
		expect(g.width).toBe(4)
		expect(g.height).toBe(2)
		expect(g.data.length).toBe(4 * 2 * 3)
		// leftmost pixel ~ black, rightmost ~ white
		expect(g.data[0]).toBeLessThan(20)
		expect(g.data[(1 * 4 + 3) * 3]).toBeGreaterThan(235) // x=3 of row 1
	})

	it('radialGradient center is the inner color', () => {
		const g = radialGradient(5, 5, { r: 255, g: 255, b: 255 }, { r: 0, g: 0, b: 0 })
		const cx = 2
		const cy = 2
		const i = (cy * 5 + cx) * 3
		expect(g.data[i]).toBeGreaterThan(235) // center ~ white
	})

	it('valueNoise is deterministic for a given seed', () => {
		const a = valueNoise(8, 8, 4, 42)
		const b = valueNoise(8, 8, 4, 42)
		expect(Buffer.compare(a.data, b.data)).toBe(0)
	})

	it('checker alternates cells', () => {
		const c = checker(4, 4, 2, { r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })
		// (0,0) cell0 color c1=black, (2,0) cell1 color c2=white
		expect(c.data[0]).toBe(0)
		expect(c.data[(0 * 4 + 2) * 3]).toBe(255)
	})

	it('mulberry32 is deterministic', () => {
		const a = mulberry32(123)
		const b = mulberry32(123)
		expect(a()).toBe(b())
	})
})

describe('svg generators', () => {
	it('svgPolygon emits a valid polygon element with N points', () => {
		const svg = svgPolygon(50, 50, 10, 6)
		expect(svg).toContain('<polygon')
		const ptsMatch = svg.match(/points="([^"]*)"/)
		expect(ptsMatch?.[1]?.trim().split(/\s+/).length).toBe(6)
	})

	it('svgStar emits a closed path with fill', () => {
		const svg = svgStar(50, 50, 20, 8, 5, '#4169E1')
		expect(svg).toContain('<path')
		expect(svg).toContain('fill="#4169E1"')
		expect(svg).toContain('Z')
	})

	it('svgDocument wraps body and sets viewBox', () => {
		const doc = svgDocument(100, 50, svgPolygon(50, 25, 10, 3))
		expect(doc).toContain('viewBox="0 0 100 50"')
		expect(doc).toContain('<polygon')
		expect(doc.startsWith('<svg')).toBe(true)
		expect(doc.trim().endsWith('</svg>')).toBe(true)
	})
})
