import { randomUUID } from 'crypto'
import { readFile, stat } from 'fs/promises'
import { extname, basename } from 'path'
import type { ImageAnalysis, DetectedObject, SupportedFormat, VisionProviderFn } from './types.js'

const SUPPORTED_FORMATS: SupportedFormat[] = [
  { extension: '.png', mimeType: 'image/png', category: 'image', parsingSupported: true },
  { extension: '.jpg', mimeType: 'image/jpeg', category: 'image', parsingSupported: true },
  { extension: '.jpeg', mimeType: 'image/jpeg', category: 'image', parsingSupported: true },
  { extension: '.gif', mimeType: 'image/gif', category: 'image', parsingSupported: true },
  { extension: '.webp', mimeType: 'image/webp', category: 'image', parsingSupported: true },
  { extension: '.bmp', mimeType: 'image/bmp', category: 'image', parsingSupported: true },
  { extension: '.svg', mimeType: 'image/svg+xml', category: 'image', parsingSupported: true },
]

let visionProvider: VisionProviderFn | null = null

/**
 * Register a vision provider function for image analysis.
 */
export function setVisionProvider(provider: VisionProviderFn): void {
  visionProvider = provider
}

function getFormatFromPath(filePath: string): string {
  return extname(filePath).toLowerCase()
}

function isImageFile(filePath: string): boolean {
  const ext = getFormatFromPath(filePath)
  return SUPPORTED_FORMATS.some(f => f.extension === ext)
}

function parseSVGDimensions(content: string): { width: number; height: number } {
  const widthMatch = content.match(/width="(\d+)"/)
  const heightMatch = content.match(/height="(\d+)"/)
  return {
    width: widthMatch ? parseInt(widthMatch[1]!, 10) : 0,
    height: heightMatch ? parseInt(heightMatch[1]!, 10) : 0,
  }
}

function extractSVGText(content: string): string[] {
  const texts: string[] = []
  const textRegex = /<text[^>]*>(.*?)<\/text>/gs
  let match: RegExpExecArray | null
  while ((match = textRegex.exec(content)) !== null) {
    if (match[1] && match[1].trim()) {
      texts.push(match[1].trim())
    }
  }
  return texts
}

function extractSVGColors(content: string): string[] {
  const colors = new Set<string>()
  const colorPatterns = [
    /fill="([^"]+)"/g,
    /stroke="([^"]+)"/g,
    /color:([^;"]+)/g,
  ]
  for (const pattern of colorPatterns) {
    let match: RegExpExecArray | null
    while ((match = pattern.exec(content)) !== null) {
      const color = match[1]!.trim()
      if (color !== 'none' && color !== 'transparent' && !color.startsWith('url')) {
        colors.add(color)
      }
    }
  }
  return Array.from(colors).slice(0, 10)
}

/**
 * Parse basic image dimensions from PNG, JPEG, BMP, GIF binary headers.
 * No external dependencies — reads raw bytes.
 */
function parseImageDimensions(buffer: Buffer, format: string): { width: number; height: number } {
  try {
    if (format === '.png') {
      // PNG: width/height at bytes 16-23 (big-endian uint32)
      if (buffer.length >= 24 && buffer.toString('ascii', 1, 4) === 'PNG') {
        return {
          width: buffer.readUInt32BE(16),
          height: buffer.readUInt32BE(20),
        }
      }
    }
    if (format === '.jpg' || format === '.jpeg') {
      // JPEG: scan SOF markers
      let offset = 2 // skip SOI marker
      while (offset < buffer.length - 1) {
        if (buffer[offset] !== 0xFF) break
        const marker = buffer[offset + 1]
        // SOF0 (0xC0), SOF1 (0xC1), SOF2 (0xC2)
        if (marker === 0xC0 || marker === 0xC1 || marker === 0xC2) {
          const height = buffer.readUInt16BE(offset + 5)
          const width = buffer.readUInt16BE(offset + 7)
          return { width, height }
        }
        // Skip to next marker
        const segLen = buffer.readUInt16BE(offset + 2)
        offset += 2 + segLen
      }
    }
    if (format === '.bmp') {
      // BMP: width at offset 18, height at offset 22 (little-endian int32)
      if (buffer.length >= 26) {
        return {
          width: buffer.readInt32LE(18),
          height: Math.abs(buffer.readInt32LE(22)),
        }
      }
    }
    if (format === '.gif') {
      // GIF: width/height at offset 6-9 (little-endian uint16)
      if (buffer.length >= 10 && buffer.toString('ascii', 0, 3) === 'GIF') {
        return {
          width: buffer.readUInt16LE(6),
          height: buffer.readUInt16LE(8),
        }
      }
    }
  } catch {
    // Header parsing failed
  }
  return { width: 0, height: 0 }
}

/**
 * Compute a difference hash (dHash) from raw image bytes.
 * Resizes conceptually to gridSize x gridSize by sampling evenly-spaced pixels.
 * Returns a 64-bit hash as a hex string.
 */
function computeDHash(buffer: Buffer, width: number, height: number, gridSize: number = 8): bigint {
  if (width === 0 || height === 0 || buffer.length < 100) return 0n

  // Sample brightness values at grid points
  const grid: number[] = []
  const bytesPerPixel = Math.max(1, Math.floor(buffer.length / (width * height * 3)))

  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const px = Math.floor((col + 0.5) * width / gridSize)
      const py = Math.floor((row + 0.5) * height / gridSize)
      const idx = Math.min((py * width + px) * bytesPerPixel, buffer.length - 3)

      // Average RGB for brightness
      const r = buffer[idx] || 0
      const g = buffer[idx + 1] || 0
      const b = buffer[idx + 2] || 0
      grid.push(0.299 * r + 0.587 * g + 0.114 * b)
    }
  }

  // Compute horizontal gradient hash
  let hash = 0n
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize - 1; col++) {
      const idx = row * gridSize + col
      if (grid[idx + 1] > grid[idx]) {
        hash |= 1n << BigInt(row * (gridSize - 1) + col)
      }
    }
  }
  return hash
}

/**
 * Compute Hamming distance between two bigint hashes.
 */
function hammingDistance(a: bigint, b: bigint): number {
  let xor = a ^ b
  let count = 0
  while (xor !== 0n) {
    count += Number(xor & 1n)
    xor >>= 1n
  }
  return count
}

/**
 * Compute a simple color histogram from raw pixel data.
 * Returns 64-bin histogram (4 bits per R/G/B channel, combined).
 */
function computeColorHistogram(buffer: Buffer, sampleStep: number = 100): number[] {
  const bins = 64
  const histogram = new Array(bins).fill(0)
  let totalSamples = 0

  // Skip likely header bytes and sample pixels
  const startOffset = Math.min(54, Math.floor(buffer.length * 0.01)) // skip BMP/PNG header area
  for (let i = startOffset; i + 2 < buffer.length; i += sampleStep) {
    const r = buffer[i] >> 6     // 2 bits
    const g = buffer[i + 1] >> 6 // 2 bits
    const b = buffer[i + 2] >> 6 // 2 bits
    const bin = (r << 4) | (g << 2) | b
    histogram[bin]++
    totalSamples++
  }

  // Normalize
  if (totalSamples > 0) {
    for (let i = 0; i < bins; i++) {
      histogram[i] /= totalSamples
    }
  }

  return histogram
}

/**
 * Compute histogram intersection similarity (0-1).
 */
function histogramSimilarity(h1: number[], h2: number[]): number {
  const len = Math.min(h1.length, h2.length)
  let intersection = 0
  for (let i = 0; i < len; i++) {
    intersection += Math.min(h1[i], h2[i])
  }
  return intersection
}

/**
 * Analyze an image file and return structured analysis results.
 * Uses vision provider when available, falls back to native parsing.
 */
export async function analyzeImage(imagePath: string): Promise<ImageAnalysis> {
  if (!isImageFile(imagePath)) {
    throw new Error(`Unsupported image format: ${getFormatFromPath(imagePath)}`)
  }

  const format = getFormatFromPath(imagePath)
  const fileStat = await stat(imagePath)
  const id = randomUUID()
  const timestamp = Date.now()

  let dimensions = { width: 0, height: 0 }
  let objects: DetectedObject[] = []
  let text: string[] = []
  let colors: string[] = []
  let description = ''
  let analysis = ''

  const rawBuffer = await readFile(imagePath)

  if (format === '.svg') {
    const content = rawBuffer.toString('utf-8')
    dimensions = parseSVGDimensions(content)
    text = extractSVGText(content)
    colors = extractSVGColors(content)
    description = `SVG image: ${basename(imagePath)}`
    objects = text.map(t => ({ label: `text: ${t.slice(0, 50)}`, confidence: 1.0 }))
  } else {
    // Parse dimensions from binary headers
    dimensions = parseImageDimensions(rawBuffer, format)
  }

  if (visionProvider) {
    try {
      const visionResult = await visionProvider(imagePath, 'Describe this image in detail. List objects, text, colors, and provide a thorough analysis.')
      analysis = visionResult
      description = visionResult.split('\n')[0] || description
    } catch {
      analysis = description
    }
  } else {
    const dimStr = dimensions.width > 0 ? ` ${dimensions.width}x${dimensions.height}` : ''
    analysis = description || `Image file: ${basename(imagePath)} (${format}${dimStr}, ${fileStat.size} bytes)`
  }

  return {
    id,
    imagePath,
    description,
    objects,
    text,
    colors,
    dimensions,
    format,
    analysis,
    timestamp,
  }
}

/**
 * Extract text content from an image using OCR via vision provider,
 * or native SVG text extraction as fallback.
 */
export async function extractText(imagePath: string): Promise<string[]> {
  if (visionProvider) {
    try {
      const result = await visionProvider(imagePath, 'Extract all text visible in this image. Return only the text, one item per line.')
      return result.split('\n').filter(line => line.trim().length > 0)
    } catch {
      // Fall through to SVG handling
    }
  }

  const format = getFormatFromPath(imagePath)
  if (format === '.svg') {
    const content = await readFile(imagePath, 'utf-8')
    return extractSVGText(content)
  }

  return []
}

/**
 * Describe an image in one paragraph using vision provider or basic metadata.
 */
export async function describeImage(imagePath: string): Promise<string> {
  if (visionProvider) {
    try {
      return await visionProvider(imagePath, 'Describe this image in one paragraph.')
    } catch {
      // Fall through
    }
  }

  const format = getFormatFromPath(imagePath)
  const fileStat = await stat(imagePath)
  const rawBuffer = await readFile(imagePath)
  const dims = parseImageDimensions(rawBuffer, format)
  const dimStr = dims.width > 0 ? `${dims.width}x${dims.height}` : 'unknown dimensions'
  return `Image file: ${basename(imagePath)} (${format}, ${dimStr}, ${fileStat.size} bytes)`
}

/**
 * Compare two images using perceptual hashing and histogram analysis.
 * When a vision provider is available, also requests AI-powered visual comparison.
 * Returns a structured comparison with similarity scores.
 */
export async function compareImages(image1: string, image2: string): Promise<string> {
  const format1 = getFormatFromPath(image1)
  const format2 = getFormatFromPath(image2)

  // Read both files
  const [buf1, buf2, stat1, stat2] = await Promise.all([
    readFile(image1),
    readFile(image2),
    stat(image1),
    stat(image2),
  ])

  const dims1 = parseImageDimensions(buf1, format1)
  const dims2 = parseImageDimensions(buf2, format2)

  const results: string[] = []

  // Structural comparison
  results.push(`File 1: ${basename(image1)} (${format1}, ${dims1.width}x${dims1.height}, ${stat1.size} bytes)`)
  results.push(`File 2: ${basename(image2)} (${format2}, ${dims2.width}x${dims2.height}, ${stat2.size} bytes)`)

  // Size similarity
  const sizeRatio = Math.min(stat1.size, stat2.size) / Math.max(stat1.size, stat2.size)
  results.push(`\nFile size similarity: ${(sizeRatio * 100).toFixed(1)}%`)

  // Dimension comparison
  if (dims1.width > 0 && dims2.width > 0) {
    const dimMatch = dims1.width === dims2.width && dims1.height === dims2.height
    results.push(`Dimensions: ${dimMatch ? 'IDENTICAL' : 'Different'} (${dims1.width}x${dims1.height} vs ${dims2.width}x${dims2.height})`)

    // Perceptual hash comparison (dHash)
    const hash1 = computeDHash(buf1, dims1.width, dims1.height)
    const hash2 = computeDHash(buf2, dims2.width, dims2.height)
    const hashBits = 49 // 7 bits per row * 7 rows for 8x8 grid
    const distance = hammingDistance(hash1, hash2)
    const hashSimilarity = Math.max(0, (1 - distance / hashBits)) * 100
    results.push(`Perceptual hash similarity: ${hashSimilarity.toFixed(1)}% (dHash, Hamming distance: ${distance})`)
  }

  // Color histogram comparison
  const sampleStep = Math.max(1, Math.floor(Math.max(buf1.length, buf2.length) / 5000))
  const hist1 = computeColorHistogram(buf1, sampleStep)
  const hist2 = computeColorHistogram(buf2, sampleStep)
  const colorSim = histogramSimilarity(hist1, hist2) * 100
  results.push(`Color distribution similarity: ${colorSim.toFixed(1)}%`)

  // Exact byte comparison
  if (buf1.length === buf2.length) {
    let identical = true
    for (let i = 0; i < buf1.length; i++) {
      if (buf1[i] !== buf2[i]) { identical = false; break }
    }
    if (identical) {
      results.push('\nFiles are BYTE-FOR-BYTE IDENTICAL.')
    }
  }

  // Vision provider comparison (if available)
  if (visionProvider) {
    try {
      const aiComparison = await visionProvider(image1,
        `Compare this image with another image located at: ${image2}. ` +
        'Describe similarities and differences in content, composition, and style.'
      )
      results.push(`\nAI Visual Comparison:\n${aiComparison}`)
    } catch {
      // Vision provider failed, structural comparison is still valid
    }
  }

  return results.join('\n')
}

/** Get the list of supported image formats. */
export function getSupportedFormats(): SupportedFormat[] {
  return [...SUPPORTED_FORMATS]
}
