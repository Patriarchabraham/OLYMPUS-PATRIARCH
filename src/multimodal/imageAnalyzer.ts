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

  if (format === '.svg') {
    const content = await readFile(imagePath, 'utf-8')
    dimensions = parseSVGDimensions(content)
    text = extractSVGText(content)
    colors = extractSVGColors(content)
    description = `SVG image: ${basename(imagePath)}`
    objects = text.map(t => ({ label: `text: ${t.slice(0, 50)}`, confidence: 1.0 }))
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
    analysis = description || `Image file: ${basename(imagePath)} (${format}, ${fileStat.size} bytes)`
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

export async function describeImage(imagePath: string): Promise<string> {
  if (visionProvider) {
    try {
      return await visionProvider(imagePath, 'Describe this image in one paragraph.')
    } catch {
      // Fall through
    }
  }
  return `Image file: ${basename(imagePath)} (${getFormatFromPath(imagePath)})`
}

export async function compareImages(image1: string, image2: string): Promise<string> {
  if (visionProvider) {
    try {
      const [desc1, desc2] = await Promise.all([
        visionProvider(image1, 'Describe this image in detail.'),
        visionProvider(image2, 'Describe this image in detail.'),
      ])
      return `Image 1: ${desc1}\n\nImage 2: ${desc2}\n\n(Note: Detailed visual comparison requires dedicated vision API support.)`
    } catch {
      // Fall through
    }
  }
  return `Cannot compare images without a vision provider. Files: ${basename(image1)} vs ${basename(image2)}`
}

export function getSupportedFormats(): SupportedFormat[] {
  return [...SUPPORTED_FORMATS]
}
