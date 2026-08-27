/**
 * Master of Masters Studio Pro — Aphex Aural / BBE Style Ultrasonic Air Exciter.
 *
 * Generates pure 2nd-order even harmonics above 16kHz to restore 3D shimmering air,
 * vocal breath luster, and acoustic brilliance without boosting harsh sibilance.
 */

export class AuralAirExciterEngine {
	/**
	 * Generates silky ultrasonic air harmonics (18kHz - 24kHz).
	 */
	public static processAirExciter(
		inputLeft: Float32Array,
		inputRight: Float32Array,
		airIntensity = 0.45,
		sampleRate = 44100,
	): { left: Float32Array; right: Float32Array } {
		const len = inputLeft.length
		const outL = new Float32Array(len)
		const outR = new Float32Array(len)

		// Highpass filter above 14kHz for exciter sidechain
		const fHigh = 14000.0
		const rcHigh = 1.0 / (2.0 * Math.PI * fHigh)
		const dt = 1.0 / sampleRate
		const alphaHigh = rcHigh / (rcHigh + dt)

		let prevInL = 0,
			prevHpL = 0
		let prevInR = 0,
			prevHpR = 0

		for (let i = 0; i < len; i++) {
			const sL = inputLeft[i]
			const sR = inputRight[i]

			// Highpass
			const hpL = alphaHigh * (prevHpL + sL - prevInL)
			prevInL = sL
			prevHpL = hpL

			const hpR = alphaHigh * (prevHpR + sR - prevInR)
			prevInR = sR
			prevHpR = hpR

			// Asymmetric even harmonic generation (Aphex Type C model) with zero crossover glitch
			const satL = (hpL + 0.35 * hpL * hpL) / (1.0 + 0.35 * Math.abs(hpL))
			const airHarmonicL = satL - hpL

			const satR = (hpR + 0.35 * hpR * hpR) / (1.0 + 0.35 * Math.abs(hpR))
			const airHarmonicR = satR - hpR

			outL[i] = sL + airHarmonicL * airIntensity * 0.3
			outR[i] = sR + airHarmonicR * airIntensity * 0.3
		}

		return { left: outL, right: outR }
	}
}
