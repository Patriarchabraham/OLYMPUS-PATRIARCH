export interface ImageGenOptions {
  size?: string
  style?: string
  n?: number
  model?: string
}

export interface ImageGenImage {
  /** Base64-encoded image data */
  data: string
  /** Absolute file path where the image was saved */
  path: string
  /** Size of the saved file in bytes */
  size: number
}

export interface ImageGenResult {
  images: ImageGenImage[]
  provider: string
  model: string
  prompt: string
}
