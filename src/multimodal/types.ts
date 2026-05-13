export interface ImageAnalysis {
  id: string
  imagePath: string
  description: string
  objects: DetectedObject[]
  text: string[]
  colors: string[]
  dimensions: { width: number; height: number }
  format: string
  analysis: string
  timestamp: number
}

export interface DetectedObject {
  label: string
  confidence: number
  bounds?: { x: number; y: number; width: number; height: number }
}

export interface VoiceCommand {
  text: string
  intent: string
  confidence: number
  language: string
  timestamp: number
}

export interface VoiceConfig {
  inputDevice?: string
  language: string
  continuous: boolean
  silenceTimeoutMs: number
  vadThreshold: number
}

export interface TTSConfig {
  voice: string
  speed: number
  pitch: number
  volume: number
  language: string
}

export interface DocumentParseResult {
  filePath: string
  text: string
  pages: string[]
  metadata: DocumentMetadata
  tables?: string[][][]
  images?: string[]
}

export interface DocumentMetadata {
  title?: string
  author?: string
  createdAt?: string
  modifiedAt?: string
  pageCount?: number
  wordCount?: number
  format: string
}

export interface CodeVisualization {
  id: string
  type: 'flowchart' | 'sequence' | 'class-diagram' | 'dependency-graph' | 'call-tree'
  title: string
  mermaidCode: string
  description: string
  sourceElements: string[]
}

export interface SupportedFormat {
  extension: string
  mimeType: string
  category: 'image' | 'document' | 'audio' | 'video'
  parsingSupported: boolean
}

export type VisionProviderFn = (imagePath: string, prompt: string) => Promise<string>
export type STTProviderFn = (audioBuffer: Buffer) => Promise<string>
export type TTSProviderFn = (text: string, config: TTSConfig) => Promise<Buffer | void>
export type PDFParserFn = (filePath: string) => Promise<{ text: string; pages: string[]; pageCount: number }>
