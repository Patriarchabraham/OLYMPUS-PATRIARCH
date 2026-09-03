/**
 * Master of Masters Studio Pro — Neural Voice Client (48kHz RVC v2 & Colab Integration)
 *
 * Communicates with Google Colab / Local RVC FastAPI / Gradio tunnel
 * to perform 100% realistic neural voice-to-voice conversion in studio 48kHz HD.
 */

export interface NeuralVoiceConfig {
	endpointUrl: string // e.g. "https://xxxx.gradio.live" or "http://127.0.0.1:7865"
	modelName: string // e.g. "MinhaVozReal"
	pitchShift: number // -12 to +12 semitones
	indexRate: number // 0.0 to 1.0 (FAISS feature retrieval)
	protectVoiceless: number // 0.0 to 0.5 (Consonant/breath protection)
	f0Method: 'rmvpe' | 'fcpe' | 'pm' | 'harvest'
}

export const DEFAULT_CLOUD_ENDPOINTS = [
	'https://masterofmasters-voice-cloner.hf.space',
	'http://127.0.0.1:7865',
	'http://localhost:7860',
]

export class NeuralVoiceClient {
	private static config: NeuralVoiceConfig = {
		endpointUrl: localStorage.getItem('mom_colab_voice_endpoint') || DEFAULT_CLOUD_ENDPOINTS[0],
		modelName: localStorage.getItem('mom_colab_voice_model') || 'MinhaVozReal',
		pitchShift: 0,
		indexRate: 0.85,
		protectVoiceless: 0.33,
		f0Method: 'rmvpe',
	}

	private static isConnected: boolean = false
	private static isAutoConnecting: boolean = false

	public static setEndpoint(url: string): void {
		let clean = url.trim()
		if (clean.endsWith('/')) clean = clean.slice(0, -1)
		NeuralVoiceClient.config.endpointUrl = clean
		localStorage.setItem('mom_colab_voice_endpoint', clean)
	}

	public static getEndpoint(): string {
		return NeuralVoiceClient.config.endpointUrl
	}

	public static setModelName(name: string): void {
		NeuralVoiceClient.config.modelName = name.trim()
		localStorage.setItem('mom_colab_voice_model', name.trim())
	}

	public static getModelName(): string {
		return NeuralVoiceClient.config.modelName
	}

	public static setPitchShift(shift: number): void {
		NeuralVoiceClient.config.pitchShift = shift
	}

	public static setIndexRate(rate: number): void {
		NeuralVoiceClient.config.indexRate = Math.max(0, Math.min(1, rate))
	}

	public static setProtectVoiceless(protect: number): void {
		NeuralVoiceClient.config.protectVoiceless = Math.max(0, Math.min(0.5, protect))
	}

	/**
	 * Automatically probes cloud and local endpoints on startup (100% zero manual typing).
	 */
	public static async autoConnect(): Promise<{
		success: boolean
		endpoint: string
		latencyMs: number
	}> {
		if (NeuralVoiceClient.isAutoConnecting)
			return {
				success: NeuralVoiceClient.isConnected,
				endpoint: NeuralVoiceClient.config.endpointUrl,
				latencyMs: 0,
			}
		NeuralVoiceClient.isAutoConnecting = true

		const candidateUrls = [NeuralVoiceClient.config.endpointUrl, ...DEFAULT_CLOUD_ENDPOINTS].filter(
			(v, i, a) => v && a.indexOf(v) === i,
		)

		for (const url of candidateUrls) {
			const t0 = performance.now()
			try {
				const controller = new AbortController()
				const timeoutId = setTimeout(() => controller.abort(), 2500)
				const resp = await fetch(`${url}/config`, {
					method: 'GET',
					mode: 'cors',
					signal: controller.signal,
				})
				clearTimeout(timeoutId)
				const latency = Math.round(performance.now() - t0)
				if (resp.ok) {
					NeuralVoiceClient.config.endpointUrl = url
					NeuralVoiceClient.isConnected = true
					NeuralVoiceClient.isAutoConnecting = false
					return { success: true, endpoint: url, latencyMs: latency }
				}
			} catch (_e) {
				// Try next candidate
			}
		}

		NeuralVoiceClient.isAutoConnecting = false
		return { success: false, endpoint: NeuralVoiceClient.config.endpointUrl, latencyMs: 0 }
	}

	public static async testConnection(): Promise<{
		success: boolean
		message: string
		latencyMs: number
	}> {
		const auto = await NeuralVoiceClient.autoConnect()
		if (auto.success) {
			return {
				success: true,
				message: `Conectado à Nuvem 24/7 (${auto.latencyMs}ms)!`,
				latencyMs: auto.latencyMs,
			}
		}

		const t0 = performance.now()
		try {
			const resp = await fetch(`${NeuralVoiceClient.config.endpointUrl}/config`, {
				method: 'GET',
				mode: 'cors',
			})
			const latency = Math.round(performance.now() - t0)
			if (resp.ok) {
				NeuralVoiceClient.isConnected = true
				return {
					success: true,
					message: `Conectado à Nuvem GPU (${latency}ms)!`,
					latencyMs: latency,
				}
			}
		} catch (_e) {
			try {
				const resp2 = await fetch(`${NeuralVoiceClient.config.endpointUrl}/info`, {
					method: 'GET',
					mode: 'cors',
				})
				const latency2 = Math.round(performance.now() - t0)
				if (resp2.ok) {
					NeuralVoiceClient.isConnected = true
					return {
						success: true,
						message: `Conectado via Nuvem (${latency2}ms)!`,
						latencyMs: latency2,
					}
				}
			} catch (_e2) {}
		}

		NeuralVoiceClient.isConnected = false
		return { success: false, message: 'Não foi possível conectar ao servidor Colab.', latencyMs: 0 }
	}

	public static getIsConnected(): boolean {
		return NeuralVoiceClient.isConnected
	}

	/**
	 * Converts an input AudioBuffer (isolated vocal stem) into the user's real voice
	 * using the remote 48kHz RVC neural engine.
	 */
	public static async convertVoice(
		vocalBuffer: AudioBuffer,
		onProgress?: (msg: string, pct: number) => void,
	): Promise<AudioBuffer> {
		if (!NeuralVoiceClient.config.endpointUrl) {
			throw new Error('Configure a URL do Google Colab no painel de Voz.')
		}

		onProgress?.('Codificando áudio vocal 48kHz para envio ao Colab GPU...', 20)

		// Convert AudioBuffer to 48kHz WAV Blob
		const wavBlob = NeuralVoiceClient.audioBufferToWav(vocalBuffer)
		const formData = new FormData()
		formData.append('data', wavBlob, 'vocal_dry.wav')

		onProgress?.('Processando conversão neural RVC v2 com RMVPE e Índice FAISS...', 50)

		// Call endpoint
		const response = await fetch(`${NeuralVoiceClient.config.endpointUrl}/api/predict`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				data: [
					await NeuralVoiceClient.blobToBase64(wavBlob),
					NeuralVoiceClient.config.modelName,
					NeuralVoiceClient.config.pitchShift,
					NeuralVoiceClient.config.indexRate,
					NeuralVoiceClient.config.protectVoiceless,
				],
			}),
		})

		if (!response.ok) {
			throw new Error(`Erro no servidor Colab (${response.status}): ${await response.text()}`)
		}

		onProgress?.('Decodificando vocal hiper-realista 48kHz...', 85)
		const result = await response.json()
		const resultAudioBase64 = result.data?.[0]

		if (!resultAudioBase64) {
			throw new Error('Servidor não retornou dados de áudio válidos.')
		}

		// Decode returned audio to AudioBuffer
		const audioBytes = NeuralVoiceClient.base64ToArrayBuffer(resultAudioBase64)
		// @ts-expect-error
		const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 })
		const outputBuffer = await ctx.decodeAudioData(audioBytes)

		onProgress?.('Voz hiper-realista sintetizada com sucesso!', 100)
		return outputBuffer
	}

	private static audioBufferToWav(buffer: AudioBuffer): Blob {
		const numOfChan = buffer.numberOfChannels
		const length = buffer.length * numOfChan * 2 + 44
		const out = new DataView(new ArrayBuffer(length))
		const channels: Float32Array[] = []
		const sampleRate = buffer.sampleRate
		let offset = 0
		let pos = 0

		function setUint16(data: number) {
			out.setUint16(pos, data, true)
			pos += 2
		}
		function setUint32(data: number) {
			out.setUint32(pos, data, true)
			pos += 4
		}

		setUint32(0x46464952) // "RIFF"
		setUint32(length - 8)
		setUint32(0x45564157) // "WAVE"

		setUint32(0x20746d66) // "fmt " chunk
		setUint32(16) // length = 16
		setUint16(1) // PCM
		setUint16(numOfChan)
		setUint32(sampleRate)
		setUint32(sampleRate * 2 * numOfChan)
		setUint16(numOfChan * 2)
		setUint16(16) // 16-bit

		setUint32(0x61746164) // "data" chunk
		setUint32(length - pos - 4)

		for (let i = 0; i < numOfChan; i++) channels.push(buffer.getChannelData(i))

		while (offset < buffer.length) {
			for (let i = 0; i < numOfChan; i++) {
				let sample = Math.max(-1, Math.min(1, channels[i][offset]))
				sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0
				out.setInt16(pos, sample, true)
				pos += 2
			}
			offset++
		}

		return new Blob([out.buffer], { type: 'audio/wav' })
	}

	private static async blobToBase64(blob: Blob): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader()
			reader.onloadend = () => resolve(reader.result as string)
			reader.onerror = reject
			reader.readAsDataURL(blob)
		})
	}

	private static base64ToArrayBuffer(base64: string): ArrayBuffer {
		const clean = base64.includes(',') ? base64.split(',')[1] : base64
		const binaryString = window.atob(clean)
		const len = binaryString.length
		const bytes = new Uint8Array(len)
		for (let i = 0; i < len; i++) {
			bytes[i] = binaryString.charCodeAt(i)
		}
		return bytes.buffer
	}
}
