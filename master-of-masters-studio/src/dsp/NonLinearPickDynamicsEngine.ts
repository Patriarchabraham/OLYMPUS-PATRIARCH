/**
 * Master of Masters Studio Pro — Non-Linear Pick-Attack Impulse Dynamics Engine.
 * 
 * Simulates:
 * 1. Physical friction of nylon/tortoise plectrum against wound nickel/steel strings.
 * 2. Dynamic attack angles (0° to 45°) creating tactile micro-transients and expressive touch.
 */

export class NonLinearPickDynamicsEngine {
  /**
   * Applies non-linear pick scrape and impulse attack dynamics to string waveforms.
   */
  public static processPickDynamics(
    inputWave: Float32Array,
    pickAngleDeg = 25.0,
    pickMaterial = 'nylon_heavy',
    sampleRate = 44100
  ): Float32Array {
    const len = inputWave.length;
    const out = new Float32Array(len);

    const angleRad = (pickAngleDeg * Math.PI) / 180.0;
    const frictionIntensity = Math.sin(angleRad) * 0.45;
    const snapFactor = pickMaterial === 'nylon_heavy' ? 1.25 : 1.10;

    const attackSamples = Math.min(len, Math.floor(sampleRate * 0.015)); // First 15ms of pick attack

    for (let i = 0; i < len; i++) {
      const s = inputWave[i];

      if (i < attackSamples) {
        const attackEnv = 1.0 - i / attackSamples;
        // Non-linear plectrum scrape transient
        const scrape = (Math.random() * 2.0 - 1.0) * frictionIntensity * attackEnv;
        const snapped = Math.tanh(s * snapFactor + scrape);
        out[i] = snapped;
      } else {
        out[i] = s;
      }
    }

    return out;
  }
}
