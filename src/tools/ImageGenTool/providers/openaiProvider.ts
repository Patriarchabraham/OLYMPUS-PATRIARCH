import { mkdir, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import type { ImageGenImage, ImageGenOptions, ImageGenResult } from '../types.js'

const OPENAI_API_URL = 'https://api.openai.com/v1/images/generations'

function getApiKey(): string | undefined {
  return process.env.OPENAI_API_KEY
}

function resolveModel(options: ImageGenOptions): string {
  return options.model || 'dall-e-3'
}

/**
 * Generate an image using OpenAI DALL-E API.
 * Returns base64 image data that gets saved to disk.
 */
export async function generateWithOpenAI(
  prompt: string,
  options: ImageGenOptions,
  outputPath?: string,
): Promise<ImageGenResult> {
  const apiKey = getApiKey()
  if (!apiKey) {
    throw new Error(
      'OpenAI API key not found. Set the OPENAI_API_KEY environment variable.',
    )
  }

  const model = resolveModel(options)
  const size = options.size || '1024x1024'
  const n = Math.min(options.n || 1, 1) // DALL-E 3 only supports n=1

  const body: Record<string, unknown> = {
    model,
    prompt,
    size,
    n,
    response_format: 'b64_json',
  }

  if (options.style) {
    body.style = options.style
  }

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'unknown error')
    throw new Error(
      `OpenAI image generation failed (${response.status}): ${errorBody}`,
    )
  }

  const data = (await response.json()) as {
    data: Array<{ b64_json: string; revised_prompt?: string }>
  }

  if (!data.data || data.data.length === 0) {
    throw new Error('OpenAI returned no image data.')
  }

  const images: ImageGenImage[] = []
  for (let i = 0; i < data.data.length; i++) {
    const item = data.data[i]
    const base64Data = item.b64_json
    const buffer = Buffer.from(base64Data, 'base64')

    const savePath =
      outputPath ||
      join(
        process.cwd(),
        `image_${Date.now()}_${i}.png`,
      )

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
    provider: 'openai',
    model,
    prompt: data.data[0]?.revised_prompt || prompt,
  }
}

/**
 * Check if the OpenAI provider is available (has API key).
 */
export function isOpenAIAvailable(): boolean {
  return !!getApiKey()
}
