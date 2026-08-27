/**
 * Master of Masters Studio Pro — De-Hummer & Ground Loop Cleaner Engine.
 *
 * Removes 50Hz / 60Hz electrical ground loop hum and harmonic buzzing (100/120/180/240Hz)
 * from guitar amplifiers, vintage hardware, and single-coil pickups.
 */

export class DeHummerGroundCleaner {
	/**
	 * Cleans 50/60Hz ground loop hum and electrical pickup harmonics (100/120/180/240Hz)
	 * using precision high-Q Biquad Notch filters with zero impact on sub-kick or bass fundamentals.
	 */
	public static processDeHum(
		left: Float32Array,
		right: Float32Array,
		freqHz: 50 | 60 = 60,
		amount = 0.85,
		sampleRate = 44100,
	): { left: Float32Array; right: Float32Array } {
		const len = left.length
		const outL = new Float32Array(len)
		const outR = new Float32Array(len)

		if (amount <= 0.01) {
			outL.set(left)
			outR.set(right)
			return { left: outL, right: outR }
		}

		const harmonics = [freqHz, freqHz * 2, freqHz * 3, freqHz * 4]
		const numH = harmonics.length

		// Design high-Q precision notch filters (Q = 18.0)
		const filters = harmonics.map((f0) => {
			const w0 = (2.0 * Math.PI * f0) / sampleRate
			const cosw0 = Math.cos(w0)
			const sinw0 = Math.sin(w0)
			const alpha = sinw0 / (2.0 * 18.0) // Narrow Q = 18

			const a0 = 1.0 + alpha
			return {
				b0: 1.0 / a0,
				b1: (-2.0 * cosw0) / a0,
				b2: 1.0 / a0,
				a1: (-2.0 * cosw0) / a0,
				a2: (1.0 - alpha) / a0,
			}
		})

		// Copy initial samples
		let curL = new Float32Array(left)
		let curR = new Float32Array(right)

		for (let h = 0; h < numH; h++) {
			const f = filters[h]
			let x1L = 0,
				x2L = 0,
				y1L = 0,
				y2L = 0
			let x1R = 0,
				x2R = 0,
				y1R = 0,
				y2R = 0

			const nextL = new Float32Array(len)
			const nextR = new Float32Array(len)

			for (let i = 0; i < len; i++) {
				const xL = curL[i]
				const yL = f.b0 * xL + f.b1 * x1L + f.b2 * x2L - f.a1 * y1L - f.a2 * y2L
				x2L = x1L
				x1L = xL
				y2L = y1L
				y1L = yL
				nextL[i] = (1.0 - amount) * xL + amount * yL

				const xR = curR[i]
				const yR = f.b0 * xR + f.b1 * x1R + f.b2 * x2R - f.a1 * y1R - f.a2 * y2R
				x2R = x1R
				x1R = xR
				y2R = y1R
				y1R = yR
				nextR[i] = (1.0 - amount) * xR + amount * yR
			}

			curL = nextL
			curR = nextR
		}

		outL.set(curL)
		outR.set(curR)
		return { left: outL, right: outR }
	}
}
