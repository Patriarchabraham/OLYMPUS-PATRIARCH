import { mkdir, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import type { ImageGenImage, ImageGenOptions, ImageGenResult } from '../types.js'

const STABILITY_API_URL = 'https://api.stability.ai/v1/generation'

const DEFAULT_ENGINE = 'stable-diffusion-xl-1024-v1-0'

function getApiKey(): string | undefined {
  return process.env.STABILITY_API_KEY
}

function resolveEngine(options: ImageGenOptions): string {
  return options.model || DEFAULT_ENGINE
}

/**
 * Map generic sizes to Stability AI width/height parameters.
 */
function parseSize(size: string | undefined): {
  width: number
  height: number
} {
  switch (size) {
    case '256x256':
      return { width: 256, height: 256 }
    case '512x512':
      return { width: 512, height: 512 }
    case '1792x1024':
      return { width: 1024, height: 576 } // SDXL landscape aspect
    case '1024x1024':
    default:
      return { width: 1024, height: 1024 }
  }
}

/**
 * Generate an image using Stability AI REST API.
 */
export async function generateWithStability(
  prompt: string,
  options: ImageGenOptions,
  outputPath?: string,
): Promise<ImageGenResult> {
  const apiKey = getApiKey()
  if (!apiKey) {
    throw new Error(
      'Stability AI API key not found. Set the STABILITY_API_KEY environment variable.',
    )
  }

  const engine = resolveEngine(options)
  const { width, height } = parseSize(options.size)
  const n = Math.min(options.n || 1, 4)

  const body: Record<string, unknown> = {
    text_prompts: [{ text: prompt, weight: 1 }],
    cfg_scale: 7,
    width,
    height,
    steps: 30,
    samples: n,
  }

  if (options.style) {
    body.style_preset = options.style
  }

  const url = `${STABILITY_API_URL}/${engine}/text-to-image`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'unknown error')
    throw new Error(
      `Stability AI image generation failed (${response.status}): ${errorBody}`,
    )
  }

  const data = (await response.json()) as {
    artifacts: Array<{ base64: string; seed: number; finishReason: string }>
  }

  if (!data.artifacts || data.artifacts.length === 0) {
    throw new Error('Stability AI returned no image data.')
  }

  const images: ImageGenImage[] = []
  for (let i = 0; i < data.artifacts.length; i++) {
    const artifact = data.artifacts[i]

    if (artifact.finishReason === 'ERROR') {
      throw new Error(`Stability AI generation error for image ${i}`)
    }

    const base64Data = artifact.base64
    const buffer = Buffer.from(base64Data, 'base64')

    const savePath =
      outputPath ||
      join(process.cwd(), `image_${Date.now()}_${i}.png`)

    await mkdir(dirname(savePath), { recursive: true })
    await writeFile(savePath, buffer)

    images.push({
      data: base64Data,
      path: savePath,
      size: buffer.length,
    })
  }

  return {
    images,
    provider: 'stability',
    model: engine,
    prompt,
  }
}

/**
 * Check if the Stability AI provider is available (has API key).
 */
export function isStabilityAvailable(): boolean {
  return !!getApiKey()
}
