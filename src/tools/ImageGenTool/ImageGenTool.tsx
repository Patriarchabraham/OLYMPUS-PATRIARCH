import { PRODUCT_DISPLAY_NAME } from '../../constants/product.js'
import { buildTool, type ToolDef } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'
import {
  getImageGenPrompt,
  IMAGE_GEN_TOOL_NAME,
} from './prompt.js'
import { generateWithOpenAI, isOpenAIAvailable } from './providers/openaiProvider.js'
import { generateWithStability, isStabilityAvailable } from './providers/stabilityProvider.js'
import { generateWithLocal } from './providers/localProvider.js'
import type { ImageGenResult } from './types.js'
import { z } from 'zod/v4'

const inputSchema = lazySchema(() =>
  z.strictObject({
    prompt: z
      .string()
      .describe('Text description of the image to generate'),
    size: z
      .enum(['256x256', '512x512', '1024x1024', '1792x1024'])
      .optional()
      .default('1024x1024')
      .describe('Output image dimensions'),
    style: z
      .enum(['natural', 'vivid'])
      .optional()
      .describe('Image style (OpenAI only)'),
    n: z
      .number()
      .min(1)
      .max(4)
      .optional()
      .default(1)
      .describe('Number of images to generate'),
    provider: z
      .enum(['openai', 'stability', 'local'])
      .optional()
      .describe('Image generation provider to use'),
    outputPath: z
      .string()
      .optional()
      .describe('Path to save the generated image(s)'),
  }),
)
type InputSchema = ReturnType<typeof inputSchema>

const outputSchema = lazySchema(() =>
  z.object({
    images: z
      .array(
        z.object({
          path: z.string().describe('Absolute file path of the saved image'),
          size: z.number().describe('File size in bytes'),
        }),
      )
      .describe('Generated image metadata'),
    provider: z.string().describe('Provider used for generation'),
    model: z.string().describe('Model used for generation'),
    prompt: z.string().describe('The prompt used (may be revised by the provider)'),
  }),
)
type OutputSchema = ReturnType<typeof outputSchema>

type Output = z.infer<OutputSchema>

/**
 * Resolve which provider to use: explicit > auto-detect from env keys.
 */
async function resolveProvider(
  requested: string | undefined,
): Promise<'openai' | 'stability' | 'local'> {
  if (requested === 'openai' || requested === 'stability' || requested === 'local') {
    return requested
  }

  // Auto-detect: prefer OpenAI, then Stability, then local
  if (isOpenAIAvailable()) return 'openai'
  if (isStabilityAvailable()) return 'stability'

  // Check local as last resort
  try {
    const { isLocalAvailable } = await import('./providers/localProvider.js')
    if (await isLocalAvailable()) return 'local'
  } catch {
    // Module import failed, skip local
  }

  throw new Error(
    'No image generation provider available. ' +
      'Set OPENAI_API_KEY for DALL-E 3, STABILITY_API_KEY for Stable Diffusion, ' +
      'or start Ollama locally for local generation.',
  )
}

/**
 * Dispatch to the correct provider.
 */
async function generateImage(
  provider: 'openai' | 'stability' | 'local',
  prompt: string,
  options: { size?: string; style?: string; n?: number; model?: string },
  outputPath?: string,
): Promise<ImageGenResult> {
  switch (provider) {
    case 'openai':
      return generateWithOpenAI(prompt, options, outputPath)
    case 'stability':
      return generateWithStability(prompt, options, outputPath)
    case 'local':
      return generateWithLocal(prompt, options, outputPath)
    default:
      throw new Error(`Unknown image generation provider: ${provider}`)
  }
}

/**
 * Check if any image generation provider is available.
 */
function isAnyProviderAvailable(): boolean {
  if (isOpenAIAvailable()) return true
  if (isStabilityAvailable()) return true
  // Local availability check is async, so optimistically return true
  // if env var is set or no other provider is needed
  return !!process.env.OLLAMA_API_URL || !!process.env.IMAGE_GEN_ENABLED
}

export const ImageGenTool = buildTool({
  name: IMAGE_GEN_TOOL_NAME,
  searchHint: 'generate images from text descriptions',
  maxResultSizeChars: 50_000,
  shouldDefer: true,

  async description(input) {
    const provider = input.provider || 'auto-detected'
    return `${PRODUCT_DISPLAY_NAME} wants to generate an image: "${input.prompt.slice(0, 80)}" (provider: ${provider})`
  },

  userFacingName() {
    return 'Image Generation'
  },

  getToolUseSummary(input) {
    return input?.prompt ? `Generate: "${input.prompt.slice(0, 50)}"` : null
  },

  getActivityDescription(input) {
    const summary = input?.prompt
      ? `"${input.prompt.slice(0, 40)}..."`
      : 'an image'
    return `Generating ${summary}`
  },

  isEnabled() {
    return isAnyProviderAvailable()
  },

  get inputSchema(): InputSchema {
    return inputSchema()
  },

  get outputSchema(): OutputSchema {
    return outputSchema()
  },

  isConcurrencySafe() {
    return false
  },

  isReadOnly() {
    return false
  },

  toAutoClassifierInput(input) {
    return `image-gen: ${input.prompt.slice(0, 100)}`
  },

  async prompt() {
    return getImageGenPrompt()
  },

  async validateInput(input) {
    if (!input.prompt || input.prompt.trim().length === 0) {
      return {
        result: false,
        message: 'Error: Image prompt cannot be empty.',
        errorCode: 1,
      }
    }
    if (input.prompt.length > 4000) {
      return {
        result: false,
        message:
          'Error: Image prompt is too long (max 4000 characters).',
        errorCode: 2,
      }
    }
    return { result: true }
  },

  async call(input, context) {
    const provider = await resolveProvider(input.provider)
    const options = {
      size: input.size,
      style: input.style,
      n: input.n,
    }

    const result = await generateImage(
      provider,
      input.prompt,
      options,
      input.outputPath,
    )

    return { data: result }
  },

  mapToolResultToToolResultBlockParam(output: ImageGenResult, toolUseID) {
    const imageList = output.images
      .map(
        (img, i) =>
          `  Image ${i + 1}: ${img.path} (${(img.size / 1024).toFixed(1)} KB)`,
      )
      .join('\n')

    const content = [
      `Image generation complete.`,
      `Provider: ${output.provider} (${output.model})`,
      `Prompt: "${output.prompt}"`,
      `Generated ${output.images.length} image(s):`,
      imageList,
    ].join('\n')

    return {
      tool_use_id: toolUseID,
      type: 'tool_result' as const,
      content,
    }
  },
} satisfies ToolDef<InputSchema, ImageGenResult>)
