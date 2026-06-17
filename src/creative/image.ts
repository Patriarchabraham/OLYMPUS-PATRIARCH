/**
 * Creative — raster image operations (via sharp).
 *
 * A chainable pipeline over sharp's native, libvips-backed engine: transforms
 * (resize/rotate/crop/flip), filters (blur/sharpen/threshold), color
 * (brightness/contrast/saturation/hue/grayscale/negate/tint), and compositing
 * with the full set of blend modes. Every op returns the pipeline for chaining;
 * nothing renders until toBuffer/toFile. Errors surface honestly (no silent
 * no-ops); a pipeline that can't be satisfied rejects with the sharp error.
 */
import sharp from 'sharp'
import type { RawImage } from './generate.js'

export type ImageFormat = 'png' | 'jpeg' | 'webp' | 'avif' | 'tiff'

/** Encode a raw pixel buffer to a PNG Buffer (via sharp). */
export async function encodePng(raw: RawImage): Promise<Buffer> {
	return sharp(raw.data, {
		raw: { width: raw.width, height: raw.height, channels: raw.channels as 3 | 4 },
	})
		.png()
		.toBuffer()
}

export type BlendMode =
	| 'over'
	| 'multiply'
	| 'screen'
	| 'overlay'
	| 'darken'
	| 'lighten'
	| 'color-dodge'
	| 'color-burn'
	| 'hard-light'
	| 'soft-light'
	| 'difference'
	| 'exclusion'

export type ResizeFit = 'cover' | 'contain' | 'fill' | 'inside' | 'outside'

export interface ImageInfo {
	width: number
	height: number
	channels: number
	format: string
	hasAlpha: boolean
	density?: number
}

/** A composite layer for blending one image over another. */
export interface CompositeLayer {
	input: string | Buffer
	blend?: BlendMode
	top?: number
	left?: number
	gravity?: sharp.Gravity
	tile?: boolean
	premultiplied?: boolean
}

/** Chainable raster pipeline. Operations compose; render via toBuffer/toFile. */
export class Image {
	private constructor(private readonly pipeline: sharp.Sharp) {}

	/** Load from a file path or a Buffer. */
	static from(input: string | Buffer): Image {
		return new Image(sharp(input, { failOn: 'truncated' }))
	}

	/** Create a solid-color image (useful as a canvas/base layer). */
	static solid(
		width: number,
		height: number,
		rgba: { r: number; g: number; b: number; alpha?: number },
	): Image {
		const { r, g, b, alpha = 255 } = rgba
		const channels = alpha < 255 ? 4 : 3
		const buf = Buffer.alloc(width * height * channels)
		for (let i = 0; i < width * height; i++) {
			buf[i * channels] = r
			buf[i * channels + 1] = g
			buf[i * channels + 2] = b
			if (channels === 4) buf[i * channels + 3] = alpha
		}
		const s = sharp(buf, { raw: { width, height, channels: channels as 3 | 4 } })
		return new Image(s)
	}

	resize(width: number, height?: number, fit: ResizeFit = 'cover'): this {
		this.pipeline.resize(width, height, { fit })
		return this
	}

	rotate(degrees?: number): this {
		// No arg rotates using EXIF orientation; explicit degrees rotate clockwise.
		this.pipeline.rotate(degrees)
		return this
	}

	/** Crop to a rectangle. */
	crop(left: number, top: number, width: number, height: number): this {
		this.pipeline.extract({
			left: Math.round(left),
			top: Math.round(top),
			width: Math.round(width),
			height: Math.round(height),
		})
		return this
	}

	/** Flip vertically. */
	flip(): this {
		this.pipeline.flip()
		return this
	}
	/** Mirror horizontally. */
	flop(): this {
		this.pipeline.flop()
		return this
	}

	blur(sigma = 1): this {
		this.pipeline.blur(sigma)
		return this
	}
	sharpen(sigma = 1): this {
		this.pipeline.sharpen({ sigma })
		return this
	}

	/** Brightness multiplier (1.0 = unchanged). */
	brightness(b: number): this {
		this.pipeline.modulate({ brightness: b })
		return this
	}
	/** Saturation multiplier (1.0 = unchanged). */
	saturation(s: number): this {
		this.pipeline.modulate({ saturation: s })
		return this
	}
	/** Hue rotation in degrees (0-360). */
	hue(deg: number): this {
		this.pipeline.modulate({ hue: deg })
		return this
	}
	/** Contrast factor around 0.5 mid-tone (1.0 = unchanged, >1 more contrast). */
	contrast(factor: number): this {
		// out = factor * in + 0.5 * (1 - factor), applied per-channel in [0,1].
		const a = factor
		const b = 0.5 * (1 - factor)
		this.pipeline.linear(a, b)
		return this
	}

	grayscale(): this {
		this.pipeline.grayscale()
		return this
	}
	negate(): this {
		this.pipeline.negate()
		return this
	}
	tint(rgb: { r: number; g: number; b: number }): this {
		this.pipeline.tint(rgb)
		return this
	}
	threshold(value = 128): this {
		this.pipeline.threshold(value)
		return this
	}

	/** Composite one or more layers over this image with blend modes. */
	composite(layers: CompositeLayer[]): this {
		this.pipeline.composite(
			layers.map((l) => ({
				input: l.input,
				blend: l.blend ?? 'over',
				top: l.top,
				left: l.left,
				gravity: l.gravity,
				tile: l.tile,
				premultiplied: l.premultiplied,
			})),
		)
		return this
	}

	/** Read metadata without rendering the full pipeline. */
	async metadata(): Promise<ImageInfo> {
		const m = await this.pipeline.clone().metadata()
		return {
			width: m.width ?? 0,
			height: m.height ?? 0,
			channels: m.channels ?? 0,
			format: m.format ?? 'unknown',
			hasAlpha: (m.hasAlpha ?? false) || (m.channels ?? 0) === 4,
			density: m.density,
		}
	}

	/** Render to a Buffer. */
	async toBuffer(
		format: ImageFormat = 'png',
		quality?: number,
	): Promise<{ data: Buffer; info: ImageInfo }> {
		const fmt = this.pipeline.toFormat(
			format as unknown as keyof sharp.FormatEnum,
			quality != null ? { quality } : {},
		)
		const { data, info } = await fmt.toBuffer({ resolveWithObject: true })
		return {
			data,
			info: {
				width: info.width,
				height: info.height,
				channels: info.channels,
				format: info.format,
				hasAlpha: info.channels === 4,
			},
		}
	}

	/** Render to a file path. */
	async toFile(path: string, format: ImageFormat = 'png', quality?: number): Promise<ImageInfo> {
		const fmt = this.pipeline.toFormat(
			format as unknown as keyof sharp.FormatEnum,
			quality != null ? { quality } : {},
		)
		const info = await fmt.toFile(path)
		return {
			width: info.width,
			height: info.height,
			channels: info.channels,
			format: info.format,
			hasAlpha: info.channels === 4,
		}
	}
}
