export const IMAGE_GEN_TOOL_NAME = 'ImageGen'

export function getImageGenPrompt(): string {
  return `
- Generates images from text descriptions using multiple AI providers
- Available providers: openai (DALL-E 3), stability (Stable Diffusion via Stability AI), local (Ollama)
- Supported sizes: 256x256, 512x512, 1024x1024, 1792x1024 (default: 1024x1024)
- Style options: natural, vivid (OpenAI only)
- You can generate 1-4 images per request
- Generated images are saved to disk and the file path is returned
- The provider is auto-detected from available API keys, or you can specify one explicitly
- For OpenAI: requires OPENAI_API_KEY environment variable
- For Stability AI: requires STABILITY_API_KEY environment variable
- For local/Ollama: requires Ollama running at http://localhost:11434 with a compatible model
- When no provider is specified, the tool auto-selects based on available credentials
- Output includes the file path, provider used, model name, and file size
`.trim()
}
