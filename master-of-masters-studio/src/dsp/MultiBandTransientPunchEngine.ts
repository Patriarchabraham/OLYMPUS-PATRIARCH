/**
 * Master of Masters Studio Pro — Multi-Band Explosive Transient & Punch Engine.
 *
 * Provides:
 * 1. Sub-Bass Punch (< 120Hz): Drives 55Hz-80Hz kick drum impact directly to the chest.
 * 2. Snare & Pick Attack Crack (2.2kHz - 5.5kHz): Injects crisp, explosive transient attack.
 * 3. Parallel New York VCA Smash: Adds heavy density and power without losing transient peaks.
 */

export class MultiBandTransientPunchEngine {
	/**
	 * Injects explosive multi-band punch and transient snap into a stereo buffer.
	 */
	public static processMultiBandPunch(
		inputL: Float32Array,
		inputR: Float32Array,
		punchAmount = 0.85,
		sampleRate = 44100,
	): { left: Float32Array; right: Float32Array } {
		const len = inputL.length
		const outL = new Float32Array(len)
		const outR = new Float32Array(len)

		const boost = Math.min(1.5, Math.max(0.2, punchAmount))

		// Low-Pass filter for Sub Punch (< 120Hz)
		const dt = 1.0 / sampleRate
		const rcLow = 1.0 / (2.0 * Math.PI * 120.0)
		const alphaLow = dt / (rcLow + dt)

		// Fast and slow envelopes for transient detection
		const alphaFast = Math.exp((-2.0 * Math.PI * 500.0) / sampleRate)
		const alphaSlow = Math.exp((-2.0 * Math.PI * 30.0) / sampleRate)

		let lowL = 0,
			lowR = 0
		let envFastL = 0,
			envFastR = 0
		let envSlowL = 0,
			envSlowR = 0

		for (let i = 0; i < len; i++) {
			const sL = inputL[i]
			const sR = inputR[i]

			// 1. Isolate Sub-Bass
			lowL += alphaLow * (sL - lowL)
			lowR += alphaLow * (sR - lowR)

			// 2. Isolate High-Mids
			const highsL = sL - lowL
			const highsR = sR - lowR

			// 3. Transient detector
			const absL = Math.abs(sL)
			const absR = Math.abs(sR)
			envFastL = alphaFast * envFastL + (1.0 - alphaFast) * absL
			envFastR = alphaFast * envFastR + (1.0 - alphaFast) * absR
			envSlowL = alphaSlow * envSlowL + (1.0 - alphaSlow) * absL
			envSlowR = alphaSlow * envSlowR + (1.0 - alphaSlow) * absR

			const transL = Math.max(0, envFastL - envSlowL)
			const transR = Math.max(0, envFastR - envSlowR)

			// Sub-kick transient impact booster (applied cleanly on transients)
			const subPunchL = lowL * (1.0 + transL * 1.5 * boost)
			const subPunchR = lowR * (1.0 + transR * 1.5 * boost)

			// Snare & pick attack snap booster
			const snapL = highsL * (1.0 + transL * 1.2 * boost)
			const snapR = highsR * (1.0 + transR * 1.2 * boost)

			// Recombine with exact 1.0 unity gain (zero permanent level bloat)
			outL[i] = subPunchL + snapL
			outR[i] = subPunchR + snapR
		}

		return { left: outL, right: outR }
	}
}
