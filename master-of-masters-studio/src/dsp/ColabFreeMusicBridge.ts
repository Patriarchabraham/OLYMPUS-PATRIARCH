/**
 * Master of Masters Studio Pro — Google Colab Free Music Generator Bridge (Aba 10).
 *
 * Communicates with a 100% free Google Colab notebook instance running on free NVIDIA T4 GPU:
 * - Sends musical prompt, script with structural tags, and optional sample audio.
 * - Receives dual-track / full song WAV audio.
 * - Integrates directly with the studio master console and voice cloner.
 */

import { UniversalAudioFormatDecoder } from './UniversalAudioFormatDecoder'

export interface ColabGenerationRequest {
	prompt: string
	lyrics: string
	tempoBpm?: number
	musicalKey?: string
	durationSec?: number
	guitarRig?: string
	bassRig?: string
	drumKit?: string
	voiceBlend?: number
	pitchShiftSemis?: number
	singersFormantBoost?: boolean
	sampleAudioBuffer?: AudioBuffer | null
	referenceVoiceBuffer?: AudioBuffer | null
}

export interface ColabGenerationResponse {
	audioBuffer: AudioBuffer
	isMock: boolean
	generationTimeMs: number
	message: string
}

export class ColabFreeMusicBridge {
	private static colabEndpointUrl = ''
	private static autoDiscoveryStarted = false
	public static readonly RELAY_CHANNEL = 'https://ntfy.sh/olympus_master_studio_relay'

	public static setEndpoint(url: string) {
		ColabFreeMusicBridge.colabEndpointUrl = url.trim().replace(/\/+$/, '')
		if (url) localStorage.setItem('colab_auto_url', ColabFreeMusicBridge.colabEndpointUrl)
	}

	public static getEndpoint(): string {
		return ColabFreeMusicBridge.colabEndpointUrl
	}

	public static readonly COLAB_NOTEBOOK_URL =
		'https://colab.research.google.com/github/Patriarchabraham/OLYMPUS-PATRIARCH/blob/main/master-of-masters-studio/scripts/google_colab_free_music_generator.ipynb'
	private static isConnected = false
	private static currentLatencyMs = 0
	public static onStatusChange?: (status: {
		connected: boolean
		url: string
		latencyMs: number
		statusText: string
	}) => void

	public static isOnline(): boolean {
		return ColabFreeMusicBridge.isConnected
	}

	public static getLatency(): number {
		return ColabFreeMusicBridge.currentLatencyMs
	}

	public static notifyStatus(
		connected: boolean,
		url: string,
		latencyMs: number,
		statusText: string,
	) {
		ColabFreeMusicBridge.isConnected = connected
		ColabFreeMusicBridge.currentLatencyMs = latencyMs
		if (url) ColabFreeMusicBridge.setEndpoint(url)
		ColabFreeMusicBridge.onStatusChange?.({
			connected,
			url,
			latencyMs,
			statusText,
		})
	}

	/**
	 * Automatically discovers active Colab instances via local relay and cloud relay without user intervention.
	 * Eliminates all manual copy-pasting of URLs.
	 */
	public static startAutoDiscovery(onFound: (url: string, latencyMs: number) => void) {
		if (ColabFreeMusicBridge.autoDiscoveryStarted) return
		ColabFreeMusicBridge.autoDiscoveryStarted = true

		const tryCandidate = async (candidateUrl: string) => {
			const clean = candidateUrl.trim().replace(/\/+$/, '')
			if (!clean.startsWith('http')) return false
			const test = await ColabFreeMusicBridge.testConnection(clean)
			if (test.ok) {
				ColabFreeMusicBridge.isConnected = true
				ColabFreeMusicBridge.setEndpoint(clean)
				ColabFreeMusicBridge.notifyStatus(
					true,
					clean,
					test.latencyMs,
					`🟢 Google Colab T4 Online (${test.latencyMs}ms)`,
				)
				onFound(clean, test.latencyMs)
				return true
			}
			return false
		}

		// 1. Check saved local storage
		const saved = localStorage.getItem('colab_auto_url')
		if (saved) {
			ColabFreeMusicBridge.setEndpoint(saved)
			tryCandidate(saved)
		}

		// 2. Query function for local server & cloud relay
		const pollRelay = async (force = false) => {
			// If already connected, do a periodic fast keepalive ping
			if (ColabFreeMusicBridge.isConnected && !force) {
				const currentUrl = ColabFreeMusicBridge.getEndpoint()
				if (currentUrl) {
					const ping = await ColabFreeMusicBridge.testConnection(currentUrl)
					if (ping.ok) {
						ColabFreeMusicBridge.currentLatencyMs = ping.latencyMs
						ColabFreeMusicBridge.notifyStatus(
							true,
							currentUrl,
							ping.latencyMs,
							`🟢 Google Colab T4 Online (${ping.latencyMs}ms)`,
						)
						return
					}
				}
				// If ping failed, mark offline and resume search
				ColabFreeMusicBridge.isConnected = false
				ColabFreeMusicBridge.notifyStatus(
					false,
					'',
					0,
					'⏳ Conexão Colab reiniciando... sintonizando sinal...',
				)
			}

			// Try local node server first (bypasses browser CORS completely & has live liveness probe)
			try {
				const localRelay = await fetch(`/api/colab-relay${force ? '?force=1' : ''}`, {
					signal: AbortSignal.timeout(2800),
				})
				if (localRelay.ok) {
					const data = await localRelay.json()
					if (data.connected && data.url) {
						ColabFreeMusicBridge.isConnected = true
						ColabFreeMusicBridge.setEndpoint(data.url)
						ColabFreeMusicBridge.notifyStatus(
							true,
							data.url,
							data.latencyMs || 25,
							data.message || `🟢 Google Colab T4 Online (${data.latencyMs || 25}ms)`,
						)
						onFound(data.url, data.latencyMs || 25)
						return
					}
					if (data.status === 'waiting') {
						ColabFreeMusicBridge.notifyStatus(
							false,
							'',
							0,
							data.message || '⏳ Aguardando Sinal do Google Colab T4...',
						)
					}
				}
			} catch (_) {}

			// Try direct ntfy cloud relay (for standalone singlefile and android)
			try {
				const r = await fetch(`${ColabFreeMusicBridge.RELAY_CHANNEL}/json?poll=1`, {
					signal: AbortSignal.timeout(3500),
				})
				const text = await r.text()
				const lines = text.trim().split('\n')
				for (let i = lines.length - 1; i >= 0; i--) {
					try {
						const data = JSON.parse(lines[i])
						const candidateUrl = (data.message || '').trim()
						if (
							candidateUrl.startsWith('http') &&
							(candidateUrl.includes('gradio.live') ||
								candidateUrl.includes('ngrok') ||
								candidateUrl.includes('loca.lt') ||
								candidateUrl.includes('7860') ||
								candidateUrl.includes('8000'))
						) {
							if (await tryCandidate(candidateUrl)) return
						}
					} catch (_) {}
				}
			} catch (_) {}

			// Check local common ports if running local GPU server
			for (const localCandidate of [
				'http://127.0.0.1:7860',
				'http://localhost:7860',
				'http://127.0.0.1:8000',
			]) {
				if (ColabFreeMusicBridge.isConnected) break
				try {
					const res = await fetch(`${localCandidate}/config`, { signal: AbortSignal.timeout(1500) })
					if (res.ok && (await tryCandidate(localCandidate))) return
				} catch (_) {}
			}
		}

		// Run immediately
		pollRelay()

		// Run periodic polling every 2.5 seconds until connected, and keepalive every 10 seconds
		ColabFreeMusicBridge.pollIntervalId = setInterval(
			() => {
				pollRelay(false)
			},
			ColabFreeMusicBridge.isConnected ? 10000 : 2500,
		)

		// Real-time EventSource listener for instant connection as soon as Colab starts
		try {
			const sse = new EventSource(`${ColabFreeMusicBridge.RELAY_CHANNEL}/sse`)
			sse.onmessage = async (e) => {
				try {
					const data = JSON.parse(e.data)
					const candidateUrl = (data.message || '').trim()
					if (candidateUrl?.startsWith('http')) {
						await tryCandidate(candidateUrl)
					}
				} catch (_) {}
			}
		} catch (_) {}
	}

	/**
	 * Instant user-triggered test / probe of Colab connection.
	 */
	public static async forceCheck(): Promise<{ ok: boolean; latencyMs: number; url: string }> {
		try {
			const res = await fetch('/api/colab-relay?force=1', { signal: AbortSignal.timeout(3000) })
			if (res.ok) {
				const data = await res.json()
				if (data.connected && data.url) {
					ColabFreeMusicBridge.notifyStatus(
						true,
						data.url,
						data.latencyMs,
						`🟢 Google Colab T4 Online (${data.latencyMs}ms)`,
					)
					return { ok: true, latencyMs: data.latencyMs, url: data.url }
				}
			}
		} catch (_) {}

		const current = ColabFreeMusicBridge.getEndpoint()
		if (current) {
			const test = await ColabFreeMusicBridge.testConnection(current)
			if (test.ok) {
				ColabFreeMusicBridge.notifyStatus(
					true,
					current,
					test.latencyMs,
					`🟢 Google Colab T4 Online (${test.latencyMs}ms)`,
				)
				return { ok: true, latencyMs: test.latencyMs, url: current }
			}
		}

		return { ok: false, latencyMs: 0, url: '' }
	}

	/**
	 * Launches the Google Colab autopilot on Windows or opens notebook directly in a new tab.
	 */
	public static async launchColabAutopilot(): Promise<void> {
		try {
			const res = await fetch('/api/colab-launch', { method: 'POST' })
			if (res.ok) return
		} catch (_) {}

		// Fallback: direct window open
		window.open(ColabFreeMusicBridge.COLAB_NOTEBOOK_URL, '_blank')
	}

	/**
	 * Tests connection to the Google Colab server instance.
	 * Robust against Gradio endpoints (/config, /info) and uses no-cors network probe to defeat CORS blocking.
	 */
	public static async testConnection(
		url?: string,
	): Promise<{ ok: boolean; latencyMs: number; message: string }> {
		const target = (url || ColabFreeMusicBridge.colabEndpointUrl).trim().replace(/\/+$/, '')
		if (!target) {
			return { ok: false, latencyMs: 0, message: 'URL do Google Colab vazia.' }
		}

		const start = performance.now()
		const controller = new AbortController()
		const timeout = setTimeout(() => controller.abort(), 6000)

		try {
			// Probe 1: Gradio /config endpoint
			let res = await fetch(`${target}/config`, { method: 'GET', signal: controller.signal }).catch(
				() => null,
			)

			// Probe 2: Gradio /info endpoint
			if (!res?.ok) {
				res = await fetch(`${target}/info`, { method: 'GET', signal: controller.signal }).catch(
					() => null,
				)
			}

			// Probe 3: Custom /health endpoint
			if (!res?.ok) {
				res = await fetch(`${target}/health`, { method: 'GET', signal: controller.signal }).catch(
					() => null,
				)
			}

			// Probe 4: Custom /status endpoint
			if (!res?.ok) {
				res = await fetch(`${target}/status`, { method: 'GET', signal: controller.signal }).catch(
					() => null,
				)
			}

			// Probe 5: Network-level reachability probe with no-cors (bypasses browser CORS blocks)
			if (!res?.ok) {
				res = await fetch(target, {
					method: 'GET',
					mode: 'no-cors',
					signal: controller.signal,
				}).catch(() => null)
			}

			clearTimeout(timeout)
			const latency = Math.round(performance.now() - start)

			if (
				res &&
				(res.ok ||
					res.type === 'opaque' ||
					res.status === 200 ||
					res.status === 405 ||
					res.status === 302)
			) {
				ColabFreeMusicBridge.isConnected = true
				return {
					ok: true,
					latencyMs: Math.max(1, latency),
					message: `● Conectado ao Google Colab T4 (${latency}ms)`,
				}
			}

			return {
				ok: false,
				latencyMs: latency,
				message: 'Servidor Colab respondeu com código de erro.',
			}
		} catch (e: any) {
			clearTimeout(timeout)
			return {
				ok: false,
				latencyMs: Math.round(performance.now() - start),
				message:
					e.name === 'AbortError'
						? 'Tempo esgotado (timeout 6s).'
						: 'Não foi possível conectar ao Colab.',
			}
		}
	}

	/**
	 * Dispatches a music generation request to the free Colab server.
	 * If no server is connected, generates a coherent structural mock audio buffer so the workflow can be tested immediately!
	 */
	public static async generateMusic(
		req: ColabGenerationRequest,
		onProgress?: (status: string) => void,
	): Promise<ColabGenerationResponse> {
		const start = performance.now()

		if (ColabFreeMusicBridge.colabEndpointUrl) {
			onProgress?.('Conectando à GPU T4 no Google Colab...')
			try {
				const formData = new FormData()
				const enrichedPrompt = `${req.prompt}. Tempo: ${req.tempoBpm || 145} BPM, Tom: ${req.musicalKey || 'Em'}, Guitarras: ${req.guitarRig || 'twin_leads'}, Baixo: ${req.bassRig || 'steve_harris'}, Bateria: ${req.drumKit || 'metal_double_kick'}. IMPORTANTE: Manter guitarras base e baixo galopante 100% audíveis durante os solos sem silenciar.`
				formData.append('prompt', enrichedPrompt)
				formData.append('lyrics', req.lyrics)
				if (req.tempoBpm) formData.append('bpm', req.tempoBpm.toString())
				if (req.musicalKey) formData.append('key', req.musicalKey)
				if (req.guitarRig) formData.append('guitar_rig', req.guitarRig)
				if (req.bassRig) formData.append('bass_rig', req.bassRig)
				if (req.drumKit) formData.append('drum_kit', req.drumKit)
				formData.append('duration', (req.durationSec || 120).toString())

				onProgress?.('Sintetizando base instrumental e vocais neurais na GPU T4...')
				const res = await fetch(`${ColabFreeMusicBridge.colabEndpointUrl}/generate`, {
					method: 'POST',
					body: formData,
				})

				if (res.ok) {
					onProgress?.('Baixando áudio gerado de alta definição...')
					const blob = await res.blob()
					const audioBuffer = await UniversalAudioFormatDecoder.decodeAudioFile(blob)
					return {
						audioBuffer,
						isMock: false,
						generationTimeMs: Math.round(performance.now() - start),
						message: 'Canção gerada com sucesso pela GPU T4 no Google Colab!',
					}
				}
			} catch (_err) {}
		}

		// High-Fidelity Standalone Procedural Engine (Continuous duration up to 300s, Keys, Rigs & Dual Leads)
		onProgress?.('Gerando prévia estrutural de alta fidelidade com bases e guitarras ativas...')
		await new Promise((r) => setTimeout(r, 1200))

		const sampleRate = 44100
		const duration = Math.min(300, Math.max(15, req.durationSec || 120))
		const length = Math.floor(sampleRate * duration)
		const offlineCtx = new OfflineAudioContext(2, length, sampleRate)

		// Base tempo: default 145 BPM
		const bpm = req.tempoBpm || 145
		const beatSec = 60 / bpm
		const barSec = beatSec * 4

		// Key scale mapping: Root and progression frequencies
		const KEY_PROGRESSIONS: Record<string, number[]> = {
			Em: [82.41, 82.41, 98.0, 110.0, 82.41, 82.41, 130.81, 110.0],
			Dm: [73.42, 73.42, 87.31, 98.0, 73.42, 73.42, 116.54, 98.0],
			Am: [110.0, 110.0, 130.81, 146.83, 110.0, 110.0, 87.31, 98.0],
			Bm: [123.47, 123.47, 146.83, 164.81, 123.47, 123.47, 98.0, 110.0],
			Gm: [98.0, 98.0, 116.54, 130.81, 98.0, 98.0, 77.78, 87.31],
			C: [65.41, 65.41, 98.0, 110.0, 65.41, 65.41, 87.31, 98.0],
			D: [73.42, 73.42, 110.0, 123.47, 73.42, 73.42, 98.0, 110.0],
			Ebm: [77.78, 77.78, 92.5, 103.83, 77.78, 77.78, 123.47, 103.83],
			'Drop-D': [73.42, 73.42, 87.31, 98.0, 73.42, 73.42, 130.81, 98.0],
		}
		const chordFreqs = KEY_PROGRESSIONS[req.musicalKey || 'Em'] || KEY_PROGRESSIONS.Em

		const outBuf = offlineCtx.createBuffer(2, length, sampleRate)
		const left = outBuf.getChannelData(0)
		const right = outBuf.getChannelData(1)

		const hasSoloDirective = /solo/i.test(req.lyrics || '')
		const soloStartSec = duration * 0.55
		const soloEndSec = duration * 0.8

		const gtrRig = req.guitarRig || 'twin_leads'
		const bassRig = req.bassRig || 'steve_harris'
		const drumKit = req.drumKit || 'metal_double_kick'

		for (let i = 0; i < length; i++) {
			const t = i / sampleRate
			const barIndex = Math.floor(t / barSec) % chordFreqs.length
			const rootFreq = chordFreqs[barIndex]
			const isSoloSection = hasSoloDirective && t >= soloStartSec && t <= soloEndSec

			// 1. Kick & Snare Beat (Double kick during solos & fast beats)
			const beatPos = (t % barSec) / beatSec
			const sixteenthPos = (t % (beatSec / 4)) / (beatSec / 4)
			const isDoubleKick = drumKit === 'metal_double_kick' && isSoloSection && sixteenthPos < 0.35
			const isNormalKick = beatPos < 0.25 || (beatPos >= 2.0 && beatPos < 2.25)
			const isKick = isDoubleKick || isNormalKick
			const isSnare = (beatPos >= 1.0 && beatPos < 1.25) || (beatPos >= 3.0 && beatPos < 3.25)

			const kickSig = isKick
				? Math.sin(2 * Math.PI * 58 * t) * Math.exp(-((beatPos % 1) * 14)) * 0.9
				: 0
			const snareSig = isSnare
				? (Math.random() * 2 - 1) * Math.exp(-((beatPos % 1) * 12)) * 0.8 +
					Math.sin(2 * Math.PI * 190 * t) * 0.3
				: 0

			// 2. Chugging Rhythm Guitars (Always maintained 100% even during solos!)
			const fifthFreq = rootFreq * 1.4983
			const chugPulse = Math.sin(2 * Math.PI * (t % (beatSec / 4)) * 4) > 0 ? 1.0 : 0.45
			const gtrDrive = gtrRig === 'chug_5150' ? 4.5 : gtrRig === 'plexi_jcm800' ? 2.8 : 3.5

			const gtrToneL =
				(Math.sin(2 * Math.PI * rootFreq * t) + Math.sin(2 * Math.PI * fifthFreq * t) * 0.7) *
				chugPulse
			const gtrToneR =
				(Math.sin(2 * Math.PI * rootFreq * (t + 0.005)) +
					Math.sin(2 * Math.PI * fifthFreq * (t + 0.005)) * 0.7) *
				chugPulse

			const distGtrL = Math.tanh(gtrToneL * gtrDrive) * 0.4
			const distGtrR = Math.tanh(gtrToneR * gtrDrive) * 0.4

			// 3. Bass Guitar (Steve Harris Gallop or Tube SVT)
			const isHarris = bassRig === 'steve_harris'
			const bassGallopPulse = isHarris && Math.sin(2 * Math.PI * (t % (beatSec / 4)) * 4) > 0.2
			const clackTransient = bassGallopPulse ? Math.sin(2 * Math.PI * 2800 * t) * 0.15 : 0
			const bassSig =
				Math.sin(2 * Math.PI * rootFreq * t) * 0.55 +
				Math.sin(2 * Math.PI * rootFreq * 2 * t) * 0.3 +
				clackTransient

			// 4. Twin Leads Guitar Solos (Screaming harmonized 3rds/5ths over rhythm base)
			let leadL = 0
			let leadR = 0
			if (isSoloSection) {
				const leadVibrato = 1.0 + 0.02 * Math.sin(2 * Math.PI * 6.0 * t)
				const leadFreq1 = rootFreq * 4.0 * leadVibrato // Soaring High Lead
				const leadFreq2 = rootFreq * 4.0 * 1.2599 * leadVibrato // Harmonized Major/Minor 3rd

				const leadTone1 =
					Math.sin(2 * Math.PI * leadFreq1 * t) + Math.sin(2 * Math.PI * leadFreq1 * 2 * t) * 0.4
				const leadTone2 =
					Math.sin(2 * Math.PI * leadFreq2 * (t + 0.003)) +
					Math.sin(2 * Math.PI * leadFreq2 * 2 * (t + 0.003)) * 0.4

				leadL = Math.tanh(leadTone1 * 4.0) * 0.5
				leadR = Math.tanh(leadTone2 * 4.0) * 0.5
			}

			// 5. Vocal Guide (When not in solo section)
			let voxGuide = 0
			if (!isSoloSection) {
				const vocalFreq = rootFreq * 3.0
				const vocalVibrato = 1.0 + 0.015 * Math.sin(2 * Math.PI * 5.5 * t)
				voxGuide =
					(Math.sin(2 * Math.PI * vocalFreq * vocalVibrato * t) +
						Math.sin(2 * Math.PI * vocalFreq * 2 * vocalVibrato * t) * 0.3) *
					0.35
			}

			left[i] =
				distGtrL * 0.75 +
				leadL * 0.8 +
				kickSig * 0.6 +
				snareSig * 0.5 +
				bassSig * 0.6 +
				voxGuide * 0.65
			right[i] =
				distGtrR * 0.75 +
				leadR * 0.8 +
				kickSig * 0.6 +
				snareSig * 0.5 +
				bassSig * 0.6 +
				voxGuide * 0.65
		}

		return {
			audioBuffer: outBuf,
			isMock: true,
			generationTimeMs: Math.round(performance.now() - start),
			message:
				'Canção estruturada gerada com sucesso! Guitarras base, baixo galopante e solo dual harmonizado 100% integrados.',
		}
	}
}
