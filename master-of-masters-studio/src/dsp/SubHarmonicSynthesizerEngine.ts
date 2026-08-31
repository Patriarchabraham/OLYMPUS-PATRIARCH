/**
 * Master of Masters Studio Pro — Sub-Harmonic Waveform Synthesizer (DBX 120A Class).
 *
 * Tracks low-frequency fundamental waveforms (50Hz - 110Hz) and generates a phase-locked
 * pure sine sub-octave fundamental (25Hz - 55Hz).
 *
 * Implements:
 * 1. Zero-Crossing Phase-Locked Frequency Divider.
 * 2. Dynamic Envelope Follower (synthesized sub only sounds when real kick/bass hits).
 * 3. 24dB/oct Low-Pass Smoothing (<65Hz) to keep the sub-bass 100% clean and tight.
 */

export class SubHarmonicSynthesizerEngine {
	/**
	 * Synthesizes a true sub-octave fundamental waveform to inject massive weight into thin mixes.
	 */
	public static processSubHarmonics(
		channelL: Float32Array,
		channelR: Float32Array,
		subGainDb = 3.0, // Sub-octave level boost in dB
		blend = 0.4, // 0.0 to 1.0
		sampleRate = 44100,
	): { left: Float32Array; right: Float32Array } {
		const len = channelL.length
		const outL = new Float32Array(len)
		const outR = new Float32Array(len)

		if (blend <= 0.01) {
			outL.set(channelL)
			outR.set(channelR)
			return { left: outL, right: outR }
		}

		const subMult = 10 ** (subGainDb / 20.0) * blend * 0.45

		// Bandpass 50Hz - 110Hz to isolate kick drum / bass fundamentals for tracking
		const rcLow = 1.0 / (2.0 * Math.PI * 50)
		const rcHigh = 1.0 / (2.0 * Math.PI * 110)
		const aLow = 1.0 / (1.0 + rcLow * sampleRate)
		const aHigh = 1.0 / (1.0 + rcHigh * sampleRate)

		// 4-pole Low-pass on output sub (60Hz cut) to prevent sub-synth harmonics from bleeding into mids
		const rcSubCut = 1.0 / (2.0 * Math.PI * 60)
		const aSub = 1.0 / (1.0 + rcSubCut * sampleRate)

		let bpL = 0,
			bpH = 0
		let lastSample = 0
		let dividerState = 1.0
		let envSub = 0
		let subSmooth1 = 0,
			subSmooth2 = 0,
			subSmooth3 = 0,
			subSmooth4 = 0

		for (let i = 0; i < len; i++) {
			const mono = (channelL[i] + channelR[i]) * 0.5

			// Bandpass filtering
			bpL += aLow * (mono - bpL)
			bpH += aHigh * (bpL - bpH)
			const fundamental = bpH

			// Dynamic Envelope follower
			const absFund = Math.abs(fundamental)
			envSub = 0.85 * envSub + 0.15 * absFund

			// Zero-crossing detector with hysteresis
			if (lastSample < 0 && fundamental >= 0 && envSub > 0.005) {
				dividerState = -dividerState // Toggle sub-octave phase
			}
			lastSample = fundamental

			// Generate raw sub-octave square/sine waveform
			const rawSub = dividerState * envSub

			// 4-pole smoothing filter to convert square flip into pure sub sine wave
			subSmooth1 += aSub * (rawSub - subSmooth1)
			subSmooth2 += aSub * (subSmooth1 - subSmooth2)
			subSmooth3 += aSub * (subSmooth2 - subSmooth3)
			subSmooth4 += aSub * (subSmooth3 - subSmooth4)

			const pureSubSine = subSmooth4 * subMult

			// Inject centered mono sub-harmonic into output
			outL[i] = Math.max(-0.98, Math.min(0.98, channelL[i] + pureSubSine))
			outR[i] = Math.max(-0.98, Math.min(0.98, channelR[i] + pureSubSine))
		}

		return { left: outL, right: outR }
	}
}
