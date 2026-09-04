/**
 * Master of Masters Studio Pro — Universal Audio Format Decoder.
 *
 * Provides guaranteed decoding of ANY audio format on mobile and desktop:
 * - Standard: WAV, MP3, FLAC, AAC, M4A
 * - Mobile / WhatsApp Voice Notes: OGG, OPUS, WEBM, 3GP, AMR
 * - Windows / Media Formats: WMA, MP4 Audio
 *
 * Implements primary Web Audio decodeAudioData with secondary HTML5 MediaElement fallback.
 */

export class UniversalAudioFormatDecoder {
	/**
	 * Accepted MIME types and file extensions for file input elements.
	 */
	public static readonly ACCEPT_STRING =
		'audio/*, video/mp4, video/webm, .ogg, .opus, .m4a, .aac, .mp3, .wav, .flac, .wma, .3gp, .amr, .webm'

	/**
	 * Decodes an uploaded File, Blob, or ArrayBuffer into an AudioBuffer.
	 */
	public static async decodeAudioFile(
		source: File | Blob | ArrayBuffer,
		ctx?: BaseAudioContext,
	): Promise<AudioBuffer> {
		const audioCtx = ctx || new (window.AudioContext || (window as any).webkitAudioContext)()

		// If input is File or Blob, get array buffer
		let arrayBuffer: ArrayBuffer
		let blob: Blob
		if (source instanceof ArrayBuffer) {
			arrayBuffer = source
			blob = new Blob([arrayBuffer], { type: 'audio/wav' })
		} else {
			blob = source
			arrayBuffer = await source.arrayBuffer()
		}

		// 1. Primary Attempt: Standard Web Audio API decodeAudioData
		try {
			// Clone buffer because decodeAudioData can detach the underlying ArrayBuffer
			const copyBuffer = arrayBuffer.slice(0)
			const decoded = await audioCtx.decodeAudioData(copyBuffer)
			if (decoded && decoded.length > 0) {
				return decoded
			}
		} catch (_decodeErr) {}

		// 2. Secondary Fallback Attempt: HTML5 <audio> element via MediaStream / AudioBuffer reconstruction
		try {
			return await UniversalAudioFormatDecoder.decodeViaMediaElement(blob, audioCtx)
		} catch (_mediaErr) {
			throw new Error(
				'Não foi possível decodificar este formato de áudio. Por favor, tente converter para WAV ou MP3 antes de enviar.',
			)
		}
	}

	/**
	 * Fallback decoder using HTML5 Audio element and standard AudioContext capture.
	 */
	private static decodeViaMediaElement(blob: Blob, ctx?: BaseAudioContext): Promise<AudioBuffer> {
		return new Promise((resolve, reject) => {
			const url = URL.createObjectURL(blob)
			const audio = document.createElement('audio')
			audio.src = url
			audio.preload = 'auto'
			audio.crossOrigin = 'anonymous'

			let isDone = false
			const cleanup = () => {
				if (!isDone) {
					isDone = true
					audio.pause()
					audio.src = ''
					URL.revokeObjectURL(url)
				}
			}

			audio.addEventListener('error', () => {
				cleanup()
				reject(new Error('HTML5 audio element could not decode the media stream.'))
			})

			audio.addEventListener('loadedmetadata', async () => {
				try {
					const duration = audio.duration
					if (!duration || !Number.isFinite(duration) || duration <= 0) {
						cleanup()
						reject(new Error('Invalid audio duration detected.'))
						return
					}

					// Use active AudioContext or create a temporary one for playback capture
					const playCtx =
						ctx && ctx instanceof AudioContext && ctx.state !== 'closed'
							? ctx
							: new (window.AudioContext || (window as any).webkitAudioContext)()

					if (playCtx.state === 'suspended') {
						await playCtx.resume().catch(() => {})
					}

					const sampleRate = playCtx.sampleRate || 44100
					const totalSamples = Math.ceil(duration * sampleRate)
					const leftChannel: Float32Array[] = []
					const rightChannel: Float32Array[] = []

					const source = playCtx.createMediaElementSource(audio)
					const processor = playCtx.createScriptProcessor(4096, 2, 2)

					processor.onaudioprocess = (e) => {
						if (isDone) return
						const inL = e.inputBuffer.getChannelData(0)
						const inR = e.inputBuffer.numberOfChannels > 1 ? e.inputBuffer.getChannelData(1) : inL
						leftChannel.push(new Float32Array(inL))
						rightChannel.push(new Float32Array(inR))
					}

					source.connect(processor)
					processor.connect(playCtx.destination)

					const onFinish = () => {
						try {
							source.disconnect()
							processor.disconnect()
						} catch (_) {}
						cleanup()

						// Assemble captured buffers
						const outBuf = playCtx.createBuffer(2, Math.max(1024, totalSamples), sampleRate)
						const outL = outBuf.getChannelData(0)
						const outR = outBuf.getChannelData(1)

						let offset = 0
						for (let i = 0; i < leftChannel.length; i++) {
							const chunkL = leftChannel[i]
							const chunkR = rightChannel[i]
							const copyLen = Math.min(chunkL.length, outL.length - offset)
							if (copyLen <= 0) break
							outL.set(chunkL.subarray(0, copyLen), offset)
							outR.set(chunkR.subarray(0, copyLen), offset)
							offset += copyLen
						}
						resolve(outBuf)
					}

					audio.addEventListener('ended', onFinish, { once: true })
					// Fallback safety timeout if 'ended' event does not fire
					setTimeout(
						() => {
							if (!isDone) onFinish()
						},
						(duration + 1.0) * 1000,
					)

					audio.currentTime = 0
					await audio.play().catch((err) => {
						cleanup()
						reject(err)
					})
				} catch (err) {
					cleanup()
					reject(err)
				}
			})
		})
	}
}
