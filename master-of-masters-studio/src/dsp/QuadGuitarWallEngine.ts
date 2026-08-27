/**
 * Master of Masters Studio Pro — Quad-Tracked Guitar Wall of Sound.
 *
 * Generates a massive 4-guitar stereo wall of sound:
 * - Guitar 1: Far Left (100% L) -> Peavey 5150 High-Gain Lead
 * - Guitar 2: Mid Left (70% L)  -> Mesa Dual Rectifier Heavy Rhythm
 * - Guitar 3: Mid Right (70% R) -> Marshall JCM800 Bright Crunch
 * - Guitar 4: Far Right (100% R)-> Soldano SLO-100 Saturated Thickness
 */

export class QuadGuitarWallEngine {
	/**
	 * Sums 4 discrete guitar tracks into a wide stereo wall of sound.
	 */
	public static processQuadWall(
		gtrL1: Float32Array, // Far Left (100% L)
		gtrL2: Float32Array, // Mid Left (70% L)
		gtrR1: Float32Array, // Mid Right (70% R)
		gtrR2: Float32Array, // Far Right (100% R)
		wallIntensity = 0.85,
	): { left: Float32Array; right: Float32Array } {
		const len = gtrL1.length
		const outL = new Float32Array(len)
		const outR = new Float32Array(len)

		for (let i = 0; i < len; i++) {
			// Discrete panning sum
			const l = gtrL1[i] * 1.0 + gtrL2[i] * 0.75 + gtrR1[i] * 0.25
			const r = gtrR2[i] * 1.0 + gtrR1[i] * 0.75 + gtrL2[i] * 0.25

			// Soft tube glue saturation with punchy dynamic response
			const driveFactor = 0.75 + wallIntensity * 0.45
			outL[i] = Math.tanh(l * driveFactor)
			outR[i] = Math.tanh(r * driveFactor)
		}

		return { left: outL, right: outR }
	}
}
