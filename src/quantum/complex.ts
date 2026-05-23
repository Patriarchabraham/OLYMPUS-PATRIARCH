/**
 * Complex number arithmetic for quantum state amplitudes.
 *
 * Quantum states are vectors of complex numbers (amplitudes) in Hilbert space.
 * Each amplitude α satisfies |α|² = probability of measuring that basis state.
 *
 * This is real quantum mechanics math — the same used in Qiskit, Cirq, and
 * every quantum computing framework. Complex amplitudes are what make
 * superposition and entanglement mathematically possible.
 */

/** A complex number: a + bi */
export interface Complex {
  re: number
  im: number
}

/** Create a complex number */
export function complex(re: number, im: number = 0): Complex {
  return { re, im }
}

/** Complex zero: 0 + 0i */
export const ZERO: Complex = complex(0, 0)

/** Complex one: 1 + 0i */
export const ONE: Complex = complex(1, 0)

/** Imaginary unit: 0 + 1i */
export const IMAG: Complex = complex(0, 1)

/** Add two complex numbers: (a + bi) + (c + di) = (a+c) + (b+d)i */
export function add(a: Complex, b: Complex): Complex {
  return complex(a.re + b.re, a.im + b.im)
}

/** Subtract: (a + bi) - (c + di) = (a-c) + (b-d)i */
export function subtract(a: Complex, b: Complex): Complex {
  return complex(a.re - b.re, a.im - b.im)
}

/** Multiply: (a + bi)(c + di) = (ac - bd) + (ad + bc)i */
export function multiply(a: Complex, b: Complex): Complex {
  return complex(
    a.re * b.re - a.im * b.im,
    a.re * b.im + a.im * b.re,
  )
}

/** Multiply by real scalar */
export function scale(s: number, c: Complex): Complex {
  return complex(s * c.re, s * c.im)
}

/** Complex conjugate: (a + bi)* = (a - bi) */
export function conjugate(c: Complex): Complex {
  return complex(c.re, -c.im)
}

/** Absolute value: |a + bi| = √(a² + b²) */
export function magnitude(c: Complex): number {
  return Math.sqrt(c.re * c.re + c.im * c.im)
}

/** Squared magnitude: |a + bi|² = a² + b² — equals Born rule probability */
export function magnitudeSq(c: Complex): number {
  return c.re * c.re + c.im * c.im
}

/** Phase angle: arg(a + bi) = atan2(b, a) */
export function phase(c: Complex): number {
  return Math.atan2(c.im, c.re)
}

/** Euler's formula: e^(iθ) = cos(θ) + i·sin(θ) */
export function expi(theta: number): Complex {
  return complex(Math.cos(theta), Math.sin(theta))
}

/** Division: (a + bi) / (c + di) */
export function divide(a: Complex, b: Complex): Complex {
  const denom = b.re * b.re + b.im * b.im
  if (denom < 1e-30) throw new Error('Division by near-zero complex number')
  return complex(
    (a.re * b.re + a.im * b.im) / denom,
    (a.im * b.re - a.re * b.im) / denom,
  )
}

/** Approximate equality within tolerance */
export function approxEqual(a: Complex, b: Complex, tolerance: number = 1e-10): boolean {
  return Math.abs(a.re - b.re) < tolerance && Math.abs(a.im - b.im) < tolerance
}

/** Format complex number as string */
export function format(c: Complex): string {
  if (Math.abs(c.im) < 1e-10) return c.re.toFixed(4)
  if (Math.abs(c.re) < 1e-10) return `${c.im.toFixed(4)}i`
  return `${c.re.toFixed(4)} ${c.im >= 0 ? '+' : '-'} ${Math.abs(c.im).toFixed(4)}i`
}

/** Kronecker (tensor) product of two complex vectors */
export function tensorProduct(a: Complex[], b: Complex[]): Complex[] {
  const result: Complex[] = []
  for (const ai of a) {
    for (const bj of b) {
      result.push(multiply(ai, bj))
    }
  }
  return result
}

/** Inner product ⟨a|b⟩ = Σ aᵢ*bᵢ (conjugate of a, dot b) */
export function innerProduct(a: Complex[], b: Complex[]): Complex {
  let re = 0
  let im = 0
  for (let i = 0; i < a.length; i++) {
    const ca = conjugate(a[i]!)
    const bi = b[i]!
    re += ca.re * bi.re - ca.im * bi.im
    im += ca.re * bi.im + ca.im * bi.re
  }
  return complex(re, im)
}
