/**
 * Creative — 2D vector engine.
 *
 * Pure-math, zero-dependency primitives for vector graphics: vectors, affine
 * matrices, path/curve construction (line + quadratic/cubic Bezier), bounds,
 * length approximation, transforms, SVG serialization, and polygon boolean ops
 * (Sutherland–Hodgman clipping). Designed as the programmable backbone of a
 * vector tool — composable, immutable where practical, fully unit-testable.
 */

/** 2D vector / point. */
export interface Vec2 {
	readonly x: number
	readonly y: number
}

export const vec = (x: number, y: number): Vec2 => ({ x, y })
export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y })
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y })
export const scale = (a: Vec2, s: number): Vec2 => ({ x: a.x * s, y: a.y * s })
export const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y
export const cross = (a: Vec2, b: Vec2): number => a.x * b.y - a.y * b.x
export const length = (a: Vec2): number => Math.hypot(a.x, a.y)
export const normalize = (a: Vec2): Vec2 => {
	const l = length(a)
	return l === 0 ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l }
}
export const lerp = (a: Vec2, b: Vec2, t: number): Vec2 => ({
	x: a.x + (b.x - a.x) * t,
	y: a.y + (b.y - a.y) * t,
})
export const distance = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y)
/** Linear interpolation between numbers (for parameters/colors). */
export const lerpN = (a: number, b: number, t: number): number => a + (b - a) * t

/** Quadratic Bezier point at t. */
export const quadBezier = (p0: Vec2, p1: Vec2, p2: Vec2, t: number): Vec2 => {
	const u = 1 - t
	return {
		x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
		y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
	}
}
/** Cubic Bezier point at t. */
export const cubicBezier = (p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t: number): Vec2 => {
	const u = 1 - t
	const tt = t * t
	const uu = u * u
	return {
		x: uu * u * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + tt * t * p3.x,
		y: uu * u * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + tt * t * p3.y,
	}
}

/**
 * 2D affine matrix (column-major [a, b, c, d, e, f] = SVG/sharp convention):
 *   x' = a*x + c*y + e
 *   y' = b*x + d*y + f
 */
export interface Matrix {
	readonly a: number
	readonly b: number
	readonly c: number
	readonly d: number
	readonly e: number
	readonly f: number
}

export const identity = (): Matrix => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 })
export const translate = (tx: number, ty: number): Matrix => ({
	a: 1,
	b: 0,
	c: 0,
	d: 1,
	e: tx,
	f: ty,
})
export const scaleM = (sx: number, sy: number = sx): Matrix => ({
	a: sx,
	b: 0,
	c: 0,
	d: sy,
	e: 0,
	f: 0,
})
export const rotate = (rad: number): Matrix => {
	const c = Math.cos(rad)
	const s = Math.sin(rad)
	return { a: c, b: s, c: -s, d: c, e: 0, f: 0 }
}
export const skew = (radX: number, radY: number = 0): Matrix => ({
	a: 1,
	b: Math.tan(radY),
	c: Math.tan(radX),
	d: 1,
	e: 0,
	f: 0,
})

/** Compose two matrices: result applies `b` first, then `a` (a * b). */
export const multiply = (a: Matrix, b: Matrix): Matrix => ({
	a: a.a * b.a + a.c * b.b,
	b: a.b * b.a + a.d * b.b,
	c: a.a * b.c + a.c * b.d,
	d: a.b * b.c + a.d * b.d,
	e: a.a * b.e + a.c * b.f + a.e,
	f: a.b * b.e + a.d * b.f + a.f,
})

export const transformPoint = (m: Matrix, p: Vec2): Vec2 => ({
	x: m.a * p.x + m.c * p.y + m.e,
	y: m.b * p.x + m.d * p.y + m.f,
})

/** Determinant (for area/scale sign). */
export const determinant = (m: Matrix): number => m.a * m.d - m.b * m.c

/** Inverse of an affine matrix, or null if singular. */
export const invert = (m: Matrix): Matrix | null => {
	const det = determinant(m)
	if (det === 0) return null
	const inv = 1 / det
	return {
		a: m.d * inv,
		b: -m.b * inv,
		c: -m.c * inv,
		d: m.a * inv,
		e: (m.c * m.f - m.d * m.e) * inv,
		f: (m.b * m.e - m.a * m.f) * inv,
	}
}

/** Axis-aligned bounding box. */
export interface Bounds {
	readonly minX: number
	readonly minY: number
	readonly maxX: number
	readonly maxY: number
}
export const boundsOf = (pts: ReadonlyArray<Vec2>): Bounds | null => {
	if (pts.length === 0) return null
	let minX = Number.POSITIVE_INFINITY
	let minY = Number.POSITIVE_INFINITY
	let maxX = Number.NEGATIVE_INFINITY
	let maxY = Number.NEGATIVE_INFINITY
	for (const p of pts) {
		if (p.x < minX) minX = p.x
		if (p.y < minY) minY = p.y
		if (p.x > maxX) maxX = p.x
		if (p.y > maxY) maxY = p.y
	}
	return { minX, minY, maxX, maxY }
}

/** A path segment in a vector path. */
export type PathSegment =
	| { cmd: 'M'; p: Vec2 }
	| { cmd: 'L'; p: Vec2 }
	| { cmd: 'Q'; c: Vec2; p: Vec2 }
	| { cmd: 'C'; c1: Vec2; c2: Vec2; p: Vec2 }
	| { cmd: 'Z' }

/** A 2D vector path: a sub-path starts at each 'M'. */
export class Path {
	readonly segments: PathSegment[] = []
	constructor(segments: PathSegment[] = []) {
		this.segments = segments
	}

	static move(p: Vec2): Path {
		return new Path([{ cmd: 'M', p }])
	}
	lineTo(p: Vec2): this {
		this.segments.push({ cmd: 'L', p })
		return this
	}
	quadTo(c: Vec2, p: Vec2): this {
		this.segments.push({ cmd: 'Q', c, p })
		return this
	}
	cubicTo(c1: Vec2, c2: Vec2, p: Vec2): this {
		this.segments.push({ cmd: 'C', c1, c2, p })
		return this
	}
	close(): this {
		this.segments.push({ cmd: 'Z' })
		return this
	}

	/** Transform every point in the path by a matrix. */
	transform(m: Matrix): Path {
		const tx = (p: Vec2): Vec2 => transformPoint(m, p)
		return new Path(
			this.segments.map((s): PathSegment => {
				switch (s.cmd) {
					case 'M':
						return { cmd: 'M', p: tx(s.p) }
					case 'L':
						return { cmd: 'L', p: tx(s.p) }
					case 'Q':
						return { cmd: 'Q', c: tx(s.c), p: tx(s.p) }
					case 'C':
						return { cmd: 'C', c1: tx(s.c1), c2: tx(s.c2), p: tx(s.p) }
					default:
						return { cmd: 'Z' }
				}
			}),
		)
	}

	/** All anchor/control points (for bounds). */
	points(): Vec2[] {
		const out: Vec2[] = []
		for (const s of this.segments) {
			switch (s.cmd) {
				case 'M':
				case 'L':
					out.push(s.p)
					break
				case 'Q':
					out.push(s.c, s.p)
					break
				case 'C':
					out.push(s.c1, s.c2, s.p)
					break
				case 'Z':
					break
			}
		}
		return out
	}

	bounds(): Bounds | null {
		return boundsOf(this.points())
	}

	/** Approximate path length by flattening curves to segments. */
	length(samples = 16): number {
		let total = 0
		let cur: Vec2 | null = null
		for (const s of this.segments) {
			switch (s.cmd) {
				case 'M':
					cur = s.p
					break
				case 'L':
					if (cur) total += distance(cur, s.p)
					cur = s.p
					break
				case 'Q':
					if (cur) {
						let prev = cur
						for (let i = 1; i <= samples; i++) {
							const t = i / samples
							const pt = quadBezier(cur, s.c, s.p, t)
							total += distance(prev, pt)
							prev = pt
						}
					}
					cur = s.p
					break
				case 'C':
					if (cur) {
						let prev = cur
						for (let i = 1; i <= samples; i++) {
							const t = i / samples
							const pt = cubicBezier(cur, s.c1, s.c2, s.p, t)
							total += distance(prev, pt)
							prev = pt
						}
					}
					cur = s.p
					break
				case 'Z':
					break
			}
		}
		return total
	}

	/** Serialize to an SVG path `d` string. */
	toSvg(): string {
		const n = (v: number): string =>
			Number.isInteger(v) ? String(v) : v.toFixed(3).replace(/\.?0+$/, '')
		return this.segments
			.map((s): string => {
				switch (s.cmd) {
					case 'M':
						return `M${n(s.p.x)},${n(s.p.y)}`
					case 'L':
						return `L${n(s.p.x)},${n(s.p.y)}`
					case 'Q':
						return `Q${n(s.c.x)},${n(s.c.y)} ${n(s.p.x)},${n(s.p.y)}`
					case 'C':
						return `C${n(s.c1.x)},${n(s.c1.y)} ${n(s.c2.x)},${n(s.c2.y)} ${n(s.p.x)},${n(s.p.y)}`
					default:
						return 'Z'
				}
			})
			.join(' ')
	}
}

/** Polygon clip (Sutherland–Hodgman) of subject against a CONVEX clip polygon. */
export function clipPolygon(subject: Vec2[], clip: Vec2[]): Vec2[] {
	if (clip.length < 3) return subject
	let output = subject
	// Ensure clip polygon is consistently wound (CCW); if CW, reverse.
	const cl = ensureCCW(clip)
	for (let i = 0; i < cl.length; i++) {
		const A = cl[i]!
		const B = cl[(i + 1) % cl.length]!
		const input = output
		output = []
		if (input.length === 0) break
		for (let j = 0; j < input.length; j++) {
			const P = input[j]!
			const Q = input[(j + 1) % input.length]!
			const Pin = isInside(A, B, P)
			const Qin = isInside(A, B, Q)
			if (Pin) {
				output.push(P)
				if (!Qin) output.push(intersection(A, B, P, Q))
			} else if (Qin) {
				output.push(intersection(A, B, P, Q))
			}
		}
	}
	return output
}

/** Polygon area (shoelace); negative if CW. */
export function polygonArea(pts: Vec2[]): number {
	let a = 0
	for (let i = 0; i < pts.length; i++) {
		const p1 = pts[i]!
		const p2 = pts[(i + 1) % pts.length]!
		a += p1.x * p2.y - p2.x * p1.y
	}
	return a / 2
}

function ensureCCW(pts: Vec2[]): Vec2[] {
	return polygonArea(pts) < 0 ? [...pts].reverse() : pts
}
function isInside(a: Vec2, b: Vec2, p: Vec2): boolean {
	return cross(sub(b, a), sub(p, a)) >= 0
}
function intersection(a: Vec2, b: Vec2, p: Vec2, q: Vec2): Vec2 {
	const ap = sub(p, a)
	const rq = sub(q, p)
	const ab = sub(b, a)
	const denom = cross(ab, rq)
	const t = denom === 0 ? 0 : -cross(ab, ap) / denom
	return add(p, scale(rq, t))
}
