/**
 * Creative — generators: synthesize raster images and vector (SVG) art.
 *
 * Raster generators build raw pixel buffers (deterministic, seeded where noisy),
 * vector generators build SVG strings. Pair with image.ts (encodePng) to render
 * rasters, or emit SVG directly. Pure functions — no native deps — fully unit-testable.
 */
import { lerpN, Path, type Vec2, vec } from './vector.js'

export interface RGB {
	r: number
	g: number
	b: number
}
export interface RawImage {
	width: number
	height: number
	channels: number
	data: Buffer
}

const clamp255 = (n: number): number => (n < 0 ? 0 : n > 255 ? 255 : n)

export const interpolateColor = (c1: RGB, c2: RGB, t: number): RGB => ({
	r: clamp255(lerpN(c1.r, c2.r, t)),
	g: clamp255(lerpN(c1.g, c2.g, t)),
	b: clamp255(lerpN(c1.b, c2.b, t)),
})

/** Linear gradient as raw pixels. angle in radians (0 = left→right). */
export function linearGradient(
	width: number,
	height: number,
	c1: RGB,
	c2: RGB,
	angle = 0,
): RawImage {
	const channels = 3
	const data = Buffer.alloc(width * height * channels)
	const dx = Math.cos(angle)
	const dy = Math.sin(angle)
	// Project onto the gradient axis; normalize across the extent so the gradient
	// spans the full 0..1 range corner-to-corner.
	const diag = Math.abs(dx) * (width - 1) + Math.abs(dy) * (height - 1) || 1
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const t = (dx * x + dy * y) / diag
			const c = interpolateColor(c1, c2, Math.max(0, Math.min(1, t)))
			const i = (y * width + x) * channels
			data[i] = c.r
			data[i + 1] = c.g
			data[i + 2] = c.b
		}
	}
	return { width, height, channels, data }
}

/** Radial gradient (inner at center, outer at edge) as raw pixels. */
export function radialGradient(width: number, height: number, inner: RGB, outer: RGB): RawImage {
	const channels = 3
	const data = Buffer.alloc(width * height * channels)
	const cx = (width - 1) / 2
	const cy = (height - 1) / 2
	const maxR = Math.hypot(cx, cy) || 1
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const d = Math.hypot(x - cx, y - cy) / maxR
			const c = interpolateColor(inner, outer, Math.max(0, Math.min(1, d)))
			const i = (y * width + x) * channels
			data[i] = c.r
			data[i + 1] = c.g
			data[i + 2] = c.b
		}
	}
	return { width, height, channels, data }
}

/** Deterministic seeded PRNG (mulberry32). */
export function mulberry32(seed: number): () => number {
	let a = seed >>> 0
	return () => {
		a = (a + 0x6d2b79f5) >>> 0
		let t = a
		t = Math.imul(t ^ (t >>> 15), t | 1)
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}
}

/**
 * 2D value noise (smooth, deterministic) as raw pixels. Bilinear interpolation
 * of a seeded random grid — useful for procedural textures.
 */
export function valueNoise(
	width: number,
	height: number,
	scale = 8,
	seed = 1,
	low: RGB = { r: 0, g: 0, b: 0 },
	high: RGB = { r: 255, g: 255, b: 255 },
): RawImage {
	const channels = 3
	const data = Buffer.alloc(width * height * channels)
	const cells = Math.max(2, scale)
	const grid: number[] = []
	const rnd = mulberry32(seed)
	for (let i = 0; i < (cells + 1) * (cells + 1); i++) grid.push(rnd())
	const at = (gx: number, gy: number): number =>
		grid[((gy + cells + 1) % (cells + 1)) * (cells + 1) + ((gx + cells + 1) % (cells + 1))]!
	const smooth = (t: number): number => t * t * (3 - 2 * t)
	for (let y = 0; y < height; y++) {
		const fy = (y / height) * cells
		const gy = Math.floor(fy)
		const ty = smooth(fy - gy)
		for (let x = 0; x < width; x++) {
			const fx = (x / width) * cells
			const gx = Math.floor(fx)
			const tx = smooth(fx - gx)
			const v00 = at(gx, gy)
			const v10 = at(gx + 1, gy)
			const v01 = at(gx, gy + 1)
			const v11 = at(gx + 1, gy + 1)
			const top = lerpN(v00, v10, tx)
			const bot = lerpN(v01, v11, tx)
			const n = lerpN(top, bot, ty)
			const c = interpolateColor(low, high, n)
			const i = (y * width + x) * channels
			data[i] = c.r
			data[i + 1] = c.g
			data[i + 2] = c.b
		}
	}
	return { width, height, channels, data }
}

/** Checkerboard pattern as raw pixels. */
export function checker(
	width: number,
	height: number,
	cell = 16,
	c1: RGB = { r: 255, g: 255, b: 255 },
	c2: RGB = { r: 0, g: 0, b: 0 },
): RawImage {
	const channels = 3
	const data = Buffer.alloc(width * height * channels)
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const on = (Math.floor(x / cell) + Math.floor(y / cell)) % 2 === 0
			const c = on ? c1 : c2
			const i = (y * width + x) * channels
			data[i] = c.r
			data[i + 1] = c.g
			data[i + 2] = c.b
		}
	}
	return { width, height, channels, data }
}

// ── Vector (SVG) generators ────────────────────────────────────────────────

/** Build an SVG document string wrapping a body fragment. */
export function svgDocument(width: number, height: number, body: string): string {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n${body}\n</svg>`
}

export const svgRect = (x: number, y: number, w: number, h: number, fill = '#4169E1'): string =>
	`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`

export const svgEllipse = (
	cx: number,
	cy: number,
	rx: number,
	ry: number,
	fill = '#4169E1',
): string => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}"/>`

/** Regular polygon (n sides) centered at (cx,cy) with radius r. */
export function svgPolygon(
	cx: number,
	cy: number,
	r: number,
	sides: number,
	rotation = -Math.PI / 2,
	fill = '#4169E1',
): string {
	const pts: Vec2[] = []
	for (let i = 0; i < sides; i++) {
		const a = rotation + (i * 2 * Math.PI) / sides
		pts.push(vec(cx + r * Math.cos(a), cy + r * Math.sin(a)))
	}
	const ptsStr = pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')
	return `<polygon points="${ptsStr}" fill="${fill}"/>`
}

/** Star (outer + inner radius, n points) — a Path-constructed shape. */
export function svgStar(
	cx: number,
	cy: number,
	outer: number,
	inner: number,
	points = 5,
	fill = '#4169E1',
): string {
	const path = Path.move({ x: cx, y: cy - outer })
	for (let i = 0; i < points * 2; i++) {
		const r = i % 2 === 0 ? inner : outer
		const a = -Math.PI / 2 + ((i + 1) * Math.PI) / points
		path.lineTo({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) })
	}
	path.close()
	return `<path d="${path.toSvg()}" fill="${fill}"/>`
}

/** Serialize a vector Path to an SVG <path> element. */
export const svgPath = (path: Path, fill = 'none', stroke = '#4169E1', strokeWidth = 2): string =>
	`<path d="${path.toSvg()}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`
