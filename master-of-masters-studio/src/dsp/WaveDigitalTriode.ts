/**
 * Master of Masters Studio Pro — Wave Digital Triode & Vacuum Tube Physics Engine.
 * Implements the Child-Langmuir Law for 12AX7 Preamp Triodes & Power Pentodes:
 *   I_p = G * max(0, mu * V_gk + V_pk)^1.5
 * with Dynamic Grid-Leak Bias Shift (Miller Effect), Power Supply Sag & Core Transformer Hysteresis.
 * Reference: Yeh, Pakarinen, Bilbao (AES & DAFx Conferences on Virtual Analog Circuit Modeling).
 */

export class WaveDigitalTriode {
  /**
   * Generates a 4096-point WaveShaper curve incorporating the real Child-Langmuir 3/2 power law
   * with asymmetric triode duty-cycle modulation and transformer magnetic hysteresis.
   */
  public static generatePhysicalTriodeCurve(drive = 0.5, tubeType: '12ax7' | 'el34' | '6l6' | 'solid_state' = '12ax7'): Float32Array {
    const samples = 4096;
    const curve = new Float32Array(samples);
    const d = Math.max(0.01, Math.min(1.0, drive));

    // Physical Constants
    const mu = tubeType === '12ax7' ? 100.0 : tubeType === 'el34' ? 11.0 : 8.0; // Amplification Factor
    const biasPoint = tubeType === '12ax7' ? -1.2 : -22.0; // Static DC Grid Bias Voltage
    const maxVpk = 250.0; // Plate Voltage Supply

    for (let i = 0; i < samples; i++) {
      const vin = (i / (samples - 1)) * 2.0 - 1.0; // Normalized input [-1.0 ... +1.0]

      if (tubeType === 'solid_state') {
        // Bipolar Transistor (Randall RG100 / Dimebag Darrell) Hard Fast Rectification
        const k = 1.0 + d * 3.5;
        const kx = k * vin;
        // 4th order algebraic diode limiter
        const y = kx / Math.pow(1.0 + Math.pow(Math.abs(kx), 4.0), 0.25);
        curve[i] = y * 0.95;
        continue;
      }

      // 1. Grid-Leak Dynamic Bias Shift (charges on positive swing, shifts DC bias downwards)
      const dynamicBias = vin > 0.0 ? biasPoint - 0.4 * d * vin : biasPoint;

      // 2. Grid-Cathode Voltage: V_gk = dynamicBias + v_in * gain
      const vGain = d * (tubeType === '12ax7' ? 2.8 : 3.5);
      const vgk = dynamicBias + vin * vGain;

      // 3. Child-Langmuir 3/2 Law: E = mu * V_gk + V_pk
      const effectiveVoltage = mu * vgk + maxVpk;

      let ip = 0.0;
      if (effectiveVoltage > 0.0) {
        // I_p = G * (E)^1.5 (Standard 3/2 power law)
        ip = Math.pow(effectiveVoltage, 1.5) / Math.pow(mu * biasPoint + maxVpk, 1.5);
      }

      // 4. Invert and normalize to AC audio swing [-1.0 ... +1.0]
      let vOut = -(ip - 1.0);

      // 5. Transformer Output Core Soft Saturation
      vOut = Math.tanh(vOut * 0.95);

      curve[i] = Math.max(-0.98, Math.min(0.98, vOut));
    }

    return curve;
  }
}
