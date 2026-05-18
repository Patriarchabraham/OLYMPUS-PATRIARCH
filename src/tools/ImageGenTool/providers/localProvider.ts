import { mkdir, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import type { ImageGenImage, ImageGenOptions, ImageGenResult } from '../types.js'

const OLLAMA_API_URL = process.env.OLLAMA_API_URL || 'http://localhost:11434'

function resolveModel(options: ImageGenOptions): string {
  return options.model || 'stable-diffusion'
}

/**
 * Generate an image using a local Ollama instance.
 */
export async function generateWithLocal(
  prompt: string,
  options: ImageGenOptions,
  outputPath?: string,
): Promise<ImageGenResult> {
  const model = resolveModel(options)

  // First, check if Ollama is reachable
  try {
    const healthCheck = await fetch(`${OLLAMA_API_URL}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    })
    if (!healthCheck.ok) {
      throw new Error(`Ollama returned status ${healthCheck.status}`)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(
      `Cannot connect to Ollama at ${OLLAMA_API_URL}. Ensure Ollama is running and accessible. Error: ${msg}`,
    )
  }

  const body: Record<string, unknown> = {
    model,
    prompt,
    stream: false,
  }

  const response = await fetch(`${OLLAMA_API_URL}/api/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'unknown error')
    throw new Error(
      `Ollama image generation failed (${response.status}): ${errorBody}`,
    )
  }

  const data = (await response.json()) as {
    images?: string[]
    response?: string
    error?: string
  }

  if (data.error) {
    throw new Error(`Ollama error: ${data.error}`)
  }

  if (!data.images || data.images.length === 0) {
    throw new Error(
      `Ollama model "${model}" did not return any images. ` +
        'Make sure you have an image generation model installed (e.g., "ollama pull stable-diffusion"). ' +
        (data.response
          ? `Model response: ${data.response.slice(0, 200)}`
          : ''),
    )
  }

  const images: ImageGenImage[] = []
  for (let i = 0; i < data.images.length; i++) {
    const base64Data = data.images[i]
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
    provider: 'local',
    model,
    prompt,
  }
}

/**
 * Check if the local Ollama provider is reachable.
 */
export async function isLocalAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${OLLAMA_API_URL}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    })
    return response.ok
  } catch {
    return false
  }
}
