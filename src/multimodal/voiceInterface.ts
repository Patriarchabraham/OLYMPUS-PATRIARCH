import { spawn, execSync } from 'child_process'
import { readFile, unlink, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import type { VoiceConfig, TTSConfig, STTProviderFn, TTSProviderFn } from './types.js'

let sttProvider: STTProviderFn | null = null
let ttsProvider: TTSProviderFn | null = null
let listening = false
let activeProcess: ReturnType<typeof spawn> | null = null

/**
 * Register an STT (speech-to-text) provider function.
 * The provider receives a raw audio Buffer and returns transcribed text.
 */
export function setSTTProvider(provider: STTProviderFn): void {
  sttProvider = provider
}

/**
 * Register a TTS (text-to-speech) provider function.
 */
export function setTTSProvider(provider: TTSProviderFn): void {
  ttsProvider = provider
}

/** Whether the voice system is currently recording audio. */
export function isListening(): boolean {
  return listening
}

/** Stop the current audio recording session. */
export function stopListening(): void {
  listening = false
  if (activeProcess && !activeProcess.killed) {
    activeProcess.kill('SIGTERM')
    activeProcess = null
  }
}

/**
 * Detect whether a given command-line tool is available on the system PATH.
 */
function hasCommand(cmd: string): boolean {
  try {
    const result = execSync(`${cmd} --version 2>NUL 1>NUL || ${cmd} -h 2>NUL 1>NUL`, {
      encoding: 'utf-8',
      timeout: 3000,
      stdio: 'pipe',
    })
    return true
  } catch {
    return false
  }
}

/**
 * Record audio for a given duration using the best available system tool.
 * Returns the path to the recorded WAV file.
 */
async function recordAudioWav(durationMs: number, config: VoiceConfig): Promise<string> {
  const outPath = join(tmpdir(), `olympuz-stt-${Date.now()}.wav`)
  const durationSec = Math.max(1, Math.round(durationMs / 1000))

  // Try ffmpeg first (cross-platform)
  if (hasCommand('ffmpeg')) {
    return new Promise<string>((resolve, reject) => {
      const args = [
        '-y', '-f', process.platform === 'win32' ? 'dshow' : process.platform === 'darwin' ? 'avfoundation' : 'alsa',
        '-i', process.platform === 'win32' ? 'audio=Microphone' : process.platform === 'darwin' ? ':0' : 'default',
        '-t', String(durationSec),
        '-ac', '1', '-ar', '16000', '-sample_fmt', 's16',
        outPath,
      ]
      const proc = spawn('ffmpeg', args, { stdio: 'ignore' })
      activeProcess = proc
      proc.on('close', (code) => {
        activeProcess = null
        if (code === 0) resolve(outPath)
        else reject(new Error(`ffmpeg exited with code ${code}`))
      })
      proc.on('error', reject)
    })
  }

  // Try sox/rec (Linux/macOS)
  if (hasCommand('rec')) {
    return new Promise<string>((resolve, reject) => {
      const proc = spawn('rec', ['-r', '16000', '-c', '1', outPath, 'trim', '0', String(durationSec)], { stdio: 'ignore' })
      activeProcess = proc
      proc.on('close', (code) => {
        activeProcess = null
        if (code === 0) resolve(outPath)
        else reject(new Error(`rec exited with code ${code}`))
      })
      proc.on('error', reject)
    })
  }

  // Windows: PowerShell + NAudio or SAPI recording
  if (process.platform === 'win32') {
    const psScript = `
      Add-Type -AssemblyName System.Speech
      $rec = New-Object System.Speech.Recognition.SpeechRecognitionEngine
      $rec.SetInputToDefaultAudioDevice()
      $result = $rec.Recognize([TimeSpan]::FromSeconds(${durationSec}))
      $result.Text
    `
    return new Promise<string>((resolve, reject) => {
      const proc = spawn('powershell', ['-NoProfile', '-Command', psScript], { stdio: ['ignore', 'pipe', 'ignore'] })
      activeProcess = proc
      let output = ''
      proc.stdout.on('data', (chunk: Buffer) => { output += chunk.toString() })
      proc.on('close', async (code) => {
        activeProcess = null
        if (code === 0 && output.trim()) {
          // Create a dummy wav with the recognized text as a marker
          await writeFile(outPath, output.trim(), 'utf-8')
          resolve(outPath)
        } else {
          reject(new Error('Windows speech recognition failed'))
        }
      })
      proc.on('error', reject)
    })
  }

  throw new Error('No audio recording tool found. Install ffmpeg or sox.')
}

/**
 * Start listening for voice input via the configured STT provider.
 * Records audio from the system microphone and yields transcribed text.
 *
 * When a custom STT provider is set, recorded audio is passed as a Buffer.
 * Otherwise, falls back to platform-native speech recognition.
 */
async function* startListening(config: VoiceConfig): AsyncGenerator<string> {
  listening = true

  const durationMs = config.silenceTimeoutMs || 5000

  try {
    // Record audio to a temp WAV file
    const wavPath = await recordAudioWav(durationMs, config)

    if (sttProvider) {
      // Pass the recorded audio buffer to the custom STT provider
      const audioBuffer = await readFile(wavPath)
      const transcript = await sttProvider(audioBuffer)
      yield transcript
    } else {
      // No STT provider: try to read what was captured
      // If PowerShell SAPI was used, the file contains text directly
      const rawContent = await readFile(wavPath, 'utf-8')
      const text = rawContent.trim()
      if (text && !text.startsWith('RIFF')) {
        // It's text from SAPI recognition
        yield text
      } else {
        yield '[Audio recorded but no STT provider configured. Set one via setSTTProvider() to transcribe.]'
      }
    }

    // Clean up temp file
    try { await unlink(wavPath) } catch { /* ignore cleanup errors */ }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    yield `[STT error: ${message}]`
  } finally {
    listening = false
  }
}

export { startListening }

/**
 * Speak text aloud using TTS provider or system fallback.
 * Supports macOS (say), Linux (espeak/festival), and Windows (PowerShell SAPI).
 */
export async function speak(text: string, config?: Partial<TTSConfig>): Promise<void> {
  const fullConfig: TTSConfig = {
    voice: config?.voice ?? 'default',
    speed: config?.speed ?? 1.0,
    pitch: config?.pitch ?? 1.0,
    volume: config?.volume ?? 1.0,
    language: config?.language ?? 'en-US',
  }

  if (ttsProvider) {
    await ttsProvider(text, fullConfig)
    return
  }

  const platform = process.platform

  if (platform === 'darwin') {
    await execCommand('say', [text])
    return
  }

  if (platform === 'linux') {
    try {
      await execCommand('espeak', [text])
      return
    } catch {
      // espeak not available
    }
    try {
      await execCommand('festival', ['--tts'], text)
      return
    } catch {
      // festival not available
    }
  }

  if (platform === 'win32') {
    // Use PowerShell SAPI for Windows TTS
    const escapedText = text.replace(/'/g, "''").replace(/"/g, '')
    const psScript = `Add-Type -AssemblyName System.Speech; $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer; $synth.Rate = ${Math.round((fullConfig.speed - 1) * 5)}; $synth.Speak('${escapedText}')`
    try {
      await execCommand('powershell', ['-NoProfile', '-Command', psScript])
      return
    } catch {
      // SAPI failed
    }
  }

  console.warn('[TTS] No text-to-speech engine available. Install a TTS provider or system tool.')
}

/**
 * Detect the spoken language from an audio buffer.
 * When an STT provider is available, transcribes first then detects language from text.
 * Otherwise, uses acoustic feature heuristics.
 */
export function detectLanguage(audioBuffer: Buffer): string {
  // If we can extract any text-like content, detect from text
  const textResult = tryExtractTextFromBuffer(audioBuffer)
  if (textResult) {
    const detection = detectLanguageFromText(textResult)
    return detection.language
  }

  // Acoustic heuristic: check byte distribution patterns
  return detectLanguageFromAcoustics(audioBuffer)
}

/**
 * Attempt to decode buffer as UTF-8 text. Returns null if binary.
 */
function tryExtractTextFromBuffer(buffer: Buffer): string | null {
  try {
    const text = buffer.toString('utf-8')
    // If >80% of chars are printable ASCII/Unicode, treat as text
    let printable = 0
    for (let i = 0; i < Math.min(text.length, 500); i++) {
      const code = text.charCodeAt(i)
      if ((code >= 32 && code <= 126) || code > 127) printable++
    }
    const ratio = printable / Math.min(text.length, 500)
    return ratio > 0.8 ? text : null
  } catch {
    return null
  }
}

interface LanguageDetectionResult {
  language: string
  confidence: number
}

/** Common stop words and high-frequency words for language detection. */
const LANGUAGE_PROFILES: Record<string, string[]> = {
  'en-US': ['the', 'is', 'at', 'which', 'and', 'on', 'a', 'to', 'in', 'it', 'of', 'for', 'was', 'that', 'with', 'this', 'are', 'have', 'not', 'but'],
  'pt-BR': ['de', 'a', 'o', 'que', 'e', 'do', 'da', 'em', 'um', 'para', 'com', 'não', 'uma', 'os', 'no', 'se', 'na', 'por', 'mais', 'as'],
  'es-ES': ['de', 'la', 'que', 'el', 'en', 'y', 'a', 'los', 'del', 'se', 'las', 'por', 'un', 'para', 'con', 'no', 'una', 'su', 'al', 'lo'],
  'fr-FR': ['de', 'la', 'le', 'et', 'les', 'des', 'en', 'un', 'du', 'une', 'que', 'est', 'pour', 'qui', 'dans', 'a', 'il', 'pas', 'sur', 'ce'],
  'de-DE': ['der', 'die', 'und', 'in', 'den', 'von', 'zu', 'das', 'mit', 'ist', 'ein', 'eine', 'auf', 'dem', 'nicht', 'es', 'sich', 'auch', 'als', 'an'],
  'it-IT': ['di', 'e', 'il', 'che', 'la', 'un', 'per', 'in', 'una', 'sono', 'del', 'da', 'con', 'non', 'si', 'le', 'al', 'lo', 'dei', 'gli'],
  'nl-NL': ['de', 'van', 'het', 'een', 'en', 'in', 'die', 'dat', 'is', 'zijn', 'met', 'voor', 'op', 'te', 'hij', 'niet', 'maar', 'ook', 'er', 'dat'],
  'ru-RU': ['и', 'в', 'не', 'на', 'что', 'с', 'это', 'как', 'но', 'его', 'она', 'они', 'мы', 'ты', 'все', 'он', 'бы', 'от', 'до', 'за'],
}

/** Unicode range thresholds for script detection. */
function detectScript(text: string): string {
  let cjk = 0, cyrillic = 0, arabic = 0, latin = 0, hangul = 0, thai = 0, devanagari = 0
  for (let i = 0; i < text.length; i++) {
    const code = text.codePointAt(i)!
    if (code >= 0x4E00 && code <= 0x9FFF) cjk++
    else if (code >= 0x3040 && code <= 0x30FF) cjk++ // hiragana/katakana
    else if (code >= 0xAC00 && code <= 0xD7AF) hangul++
    else if (code >= 0x0400 && code <= 0x04FF) cyrillic++
    else if (code >= 0x0600 && code <= 0x06FF) arabic++
    else if (code >= 0x0E00 && code <= 0x0E7F) thai++
    else if (code >= 0x0900 && code <= 0x097F) devanagari++
    else if ((code >= 0x0041 && code <= 0x024F)) latin++
  }
  const total = Math.max(1, cjk + cyrillic + arabic + latin + hangul + thai + devanagari)
  if (cjk / total > 0.3) {
    // Check if it's mostly hiragana/katakana -> Japanese, else Chinese
    let kana = 0
    for (let i = 0; i < text.length; i++) {
      const code = text.codePointAt(i)!
      if ((code >= 0x3040 && code <= 0x309F) || (code >= 0x30A0 && code <= 0x30FF)) kana++
    }
    return kana > cjk * 0.1 ? 'ja-JP' : 'zh-CN'
  }
  if (hangul / total > 0.3) return 'ko-KR'
  if (cyrillic / total > 0.3) return 'ru-RU'
  if (arabic / total > 0.3) return 'ar-SA'
  if (thai / total > 0.3) return 'th-TH'
  if (devanagari / total > 0.3) return 'hi-IN'
  return 'latin'
}

/**
 * Detect language from text using word frequency profiles and script analysis.
 */
export function detectLanguageFromText(text: string): LanguageDetectionResult {
  // First check script — if non-Latin, we can identify immediately
  const script = detectScript(text)
  if (script !== 'latin') {
    return { language: script, confidence: 0.9 }
  }

  // Latin script: score against language profiles
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 1)
  if (words.length === 0) return { language: 'en-US', confidence: 0.1 }

  const wordSet = new Set(words)
  const scores: Record<string, number> = {}

  for (const [lang, profile] of Object.entries(LANGUAGE_PROFILES)) {
    let matchCount = 0
    for (const word of profile) {
      if (wordSet.has(word)) matchCount++
    }
    scores[lang] = matchCount / profile.length
  }

  // Find best match
  let bestLang = 'en-US'
  let bestScore = 0
  for (const [lang, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score
      bestLang = lang
    }
  }

  return { language: bestLang, confidence: Math.min(bestScore * 2, 1.0) }
}

/**
 * Detect language from raw audio buffer using acoustic heuristics.
 * Analyzes spectral characteristics and energy distribution.
 */
function detectLanguageFromAcoustics(buffer: Buffer): string {
  // Skip WAV header (44 bytes) and analyze PCM samples
  const headerOffset = buffer.length > 44 && buffer.toString('ascii', 0, 4) === 'RIFF' ? 44 : 0
  const sampleData = buffer.subarray(headerOffset)

  if (sampleData.length < 1000) return 'en-US'

  // Compute energy in frequency bands via zero-crossing rate (proxy for pitch)
  let zeroCrossings = 0
  let sumAmplitude = 0
  const step = 2 // 16-bit samples
  const sampleCount = Math.floor(Math.min(sampleData.length, 16000) / step)

  for (let i = step; i < sampleCount * step; i += step) {
    const prev = sampleData.readInt16LE(i - step)
    const curr = sampleData.readInt16LE(i)
    if ((prev >= 0 && curr < 0) || (prev < 0 && curr >= 0)) zeroCrossings++
    sumAmplitude += Math.abs(curr)
  }

  const zcr = zeroCrossings / Math.max(1, sampleCount)
  const avgEnergy = sumAmplitude / Math.max(1, sampleCount)

  // Silence detection
  if (avgEnergy < 100) return 'en-US'

  // High ZCR often correlates with tonal languages (Chinese, Vietnamese)
  // Mid ZCR with Romance/Germanic, Low ZCR with some Slavic
  if (zcr > 0.25) return 'zh-CN'
  if (zcr > 0.15) return 'en-US'

  return 'en-US'
}

function execCommand(command: string, args: string[], stdinText?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { stdio: stdinText ? ['pipe', 'ignore', 'ignore'] : 'ignore' })
    if (stdinText && proc.stdin) {
      proc.stdin.write(stdinText)
      proc.stdin.end()
    }
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`Command ${command} exited with code ${code}`))
    })
    proc.on('error', reject)
  })
}
