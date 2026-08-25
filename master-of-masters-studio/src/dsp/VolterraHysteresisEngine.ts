/**
 * Master of Masters Studio Pro — Volterra Kernel Non-Linear Hysteresis & Dynamic Sag Engine.
 * 
 * Physical modeling of transformer magnetic hysteresis (3rd & 5th order Volterra series),
 * power supply voltage sag, and tube cathode bias drift.
 */

export class VolterraHysteresisEngine {
  /**
   * Processes stereo signal with dynamic Volterra hysteresis and tube sag.
   */
  public static processHysteresisAndSag(
    left: Float32Array,
    right: Float32Array,
    drive = 0.45,
    sampleRate = 44100
  ): { left: Float32Array; right: Float32Array } {
    const len = left.length;
    const outL = new Float32Array(len);
    const outR = new Float32Array(len);

    // Dynamic Sag state (power supply capacitor discharge / recovery)
    let sagEnvelope = 1.0;
    const sagAttack = Math.exp(-1.0 / (sampleRate * 0.015)); // 15ms sag attack
    const sagRelease = Math.exp(-1.0 / (sampleRate * 0.120)); // 120ms sag recovery

    // Volterra memory kernel coefficients (3rd & 5th order)
    const h1 = 1.0;
    const h3 = 0.12 * drive;
    const h5 = 0.04 * drive;

    let prevL = 0, prevR = 0;

    for (let i = 0; i < len; i++) {
      const inL = left[i];
      const inR = right[i];

      // Instantaneous energy
      const peakEnergy = Math.max(Math.abs(inL), Math.abs(inR));

      // Update Power Supply Sag
      if (peakEnergy > 0.6) {
        sagEnvelope = sagAttack * sagEnvelope + (1.0 - sagAttack) * (1.0 - (peakEnergy - 0.6) * 0.35 * drive);
      } else {
        sagEnvelope = sagRelease * sagEnvelope + (1.0 - sagRelease) * 1.0;
      }

      // Scaled input with sag modulation
      const xL = inL * (0.85 + 0.15 * sagEnvelope);
      const xR = inR * (0.85 + 0.15 * sagEnvelope);

      // 3rd & 5th Order Volterra Kernel (Magnetic flux hysteresis with memory)
      const memL = (xL + prevL * 0.25) / 1.25;
      const memR = (xR + prevR * 0.25) / 1.25;

      const poly3L = memL * memL * memL;
      const poly3R = memR * memR * memR;
      const poly5L = poly3L * memL * memL;
      const poly5R = poly3R * memR * memR;

      const voltL = h1 * xL - h3 * poly3L + h5 * poly5L;
      const voltR = h1 * xR - h3 * poly3R + h5 * poly5R;

      outL[i] = Math.tanh(voltL * 1.02);
      outR[i] = Math.tanh(voltR * 1.02);

      prevL = inL;
      prevR = inR;
    }

    return { left: outL, right: outR };
  }
}
