import { spawn } from 'child_process'
import type { VoiceConfig, TTSConfig, STTProviderFn, TTSProviderFn } from './types.js'

let sttProvider: STTProviderFn | null = null
let ttsProvider: TTSProviderFn | null = null
let listening = false
let activeProcess: ReturnType<typeof spawn> | null = null

export function setSTTProvider(provider: STTProviderFn): void {
  sttProvider = provider
}

export function setTTSProvider(provider: TTSProviderFn): void {
  ttsProvider = provider
}

export function isListening(): boolean {
  return listening
}

export function stopListening(): void {
  listening = false
  if (activeProcess && !activeProcess.killed) {
    activeProcess.kill('SIGTERM')
    activeProcess = null
  }
}

async function* startListening(config: VoiceConfig): AsyncGenerator<string> {
  listening = true

  if (sttProvider) {
    // With a custom STT provider, we yield once per provider call
    // The caller should handle continuous mode externally
    try {
      // This is a simplified approach - in production you'd stream audio chunks
      yield '[STT provider active - use companion streaming for real-time input]'
    } finally {
      listening = false
    }
    return
  }

  // Fallback: try system command-line tools
  const platform = process.platform

  if (platform === 'darwin') {
    // macOS: use `say` for TTS but there's no built-in STT command
    // Use a file-based approach with `sox` or `ffmpeg` if available
    yield '[Voice input requires STT provider on macOS. Set via setSTTProvider().]'
    listening = false
    return
  }

  if (platform === 'linux') {
    // Linux: try `arecord` to capture audio, but still need STT
    yield '[Voice input requires STT provider on Linux. Set via setSTTProvider().]'
    listening = false
    return
  }

  yield '[Voice input not supported on this platform without an STT provider.]'
  listening = false
}

// Re-export as the generator function
export { startListening }

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

  // Fallback to system TTS
  const platform = process.platform

  if (platform === 'darwin') {
    await execCommand('say', [text])
    return
  }

  if (platform === 'linux') {
    // Try espeak
    try {
      await execCommand('espeak', [text])
      return
    } catch {
      // espeak not available
    }
    // Try festival
    try {
      await execCommand('echo', [text, '|', 'festival', '--tts'])
      return
    } catch {
      // festival not available
    }
  }

  // Windows or no TTS available - silently skip
  console.warn('[TTS] No text-to-speech engine available. Install a TTS provider or system tool.')
}

export function detectLanguage(_audioBuffer: Buffer): string {
  // Language detection requires an STT/Whisper model
  // Default to the configured language or English
  return 'en-US'
}

function execCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { stdio: 'ignore' })
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`Command ${command} exited with code ${code}`))
    })
    proc.on('error', reject)
  })
}
