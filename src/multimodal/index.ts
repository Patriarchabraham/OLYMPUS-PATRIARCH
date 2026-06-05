// Multimodal capabilities for Olympuz Coder
// Image analysis, voice interface, document parsing, and code visualization

export type {
  ImageAnalysis,
  DetectedObject,
  VoiceCommand,
  VoiceConfig,
  TTSConfig,
  DocumentParseResult,
  DocumentMetadata,
  CodeVisualization,
  SupportedFormat,
  VisionProviderFn,
  STTProviderFn,
  TTSProviderFn,
  PDFParserFn,
} from './types.js'

export {
  analyzeImage,
  extractText,
  describeImage,
  compareImages,
  getSupportedFormats,
  setVisionProvider,
} from './imageAnalyzer.js'

export {
  startListening,
  stopListening,
  speak,
  isListening,
  detectLanguage,
  setSTTProvider,
  setTTSProvider,
} from './voiceInterface.js'

export {
  parseDocument,
  parseTextFile,
  parseJSON,
  parseCSV,
  parsePDF,
  detectFormat,
  setPDFParser,
} from './documentParser.js'

export {
  analyzeCodeStructure,
  generateFlowchart,
  generateSequenceDiagram,
  generateClassDiagram,
  generateDependencyGraph,
  generateCallTree,
} from './codeVisualizer.js'
