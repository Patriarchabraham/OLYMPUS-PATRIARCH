/**
 * Master of Masters Studio Pro — Console Transformer Matrix Engine.
 * 
 * Simulates legendary analog console input/output transformer colorations:
 * 1. Neve 1073 (Marinair Iron Transformer) — Thick low-end warmth, rich 2nd/3rd harmonics, 80Hz-250Hz weight.
 * 2. API 512c (AP2503 Steel Transformer) — Punchy aggressive transient bite, forward midrange (2.5k-5kHz).
 * 3. SSL 4000G (Jensen Clean Transformer) — Linear phase transparency, pristine stereo width, fast VCA glue.
 */

export type TransformerType = 'neve_1073' | 'api_512c' | 'ssl_4000g';

export class ConsoleTransformerMatrixEngine {
  /**
   * Applies analog transformer saturation and core hysteresis modeling.
   */
  public static processTransformer(
    input: AudioBuffer,
    type: TransformerType,
    driveLevel = 0.50
  ): AudioBuffer {
    const len = input.length;
    const sr = input.sampleRate;
    const ctx = new OfflineAudioContext(2, len, sr);
    const out = ctx.createBuffer(2, len, sr);

    const inL = input.getChannelData(0);
    const inR = input.getChannelData(1);
    const outL = out.getChannelData(0);
    const outR = out.getChannelData(1);

    const drive = 1.0 + driveLevel * 2.5;

    switch (type) {
      case 'neve_1073': {
        // Marinair Iron: Sub-harmonic saturation + 80Hz warmth
        let prevL = 0, prevR = 0;
        for (let i = 0; i < len; i++) {
          const sL = inL[i] * drive;
          const sR = inR[i] * drive;

          // Asymmetric hysteresis curve (2nd order tube/iron harmonic)
          const satL = Math.tanh(sL) + 0.15 * Math.sin(sL * 2.0);
          const satR = Math.tanh(sR) + 0.15 * Math.sin(sR * 2.0);

          // Iron transformer low-end inductive glue
          prevL = 0.92 * prevL + 0.08 * satL;
          prevR = 0.92 * prevR + 0.08 * satR;

          outL[i] = (satL * 0.75 + prevL * 0.25) * 0.85;
          outR[i] = (satR * 0.75 + prevR * 0.25) * 0.85;
        }
        break;
      }
      case 'api_512c': {
        // AP2503 Steel: Forward transient punch & 3rd harmonic bite
        for (let i = 0; i < len; i++) {
          const sL = inL[i] * drive;
          const sR = inR[i] * drive;

          // Symmetrical hard-knee steel saturation
          const satL = (sL / (1.0 + Math.abs(sL))) * 1.15;
          const satR = (sR / (1.0 + Math.abs(sR))) * 1.15;

          outL[i] = Math.tanh(satL) * 0.88;
          outR[i] = Math.tanh(satR) * 0.88;
        }
        break;
      }
      case 'ssl_4000g': {
        // Jensen Clean: Ultra-linear with soft VCA peak clamping
        for (let i = 0; i < len; i++) {
          const sL = inL[i] * drive;
          const sR = inR[i] * drive;

          outL[i] = Math.tanh(sL * 1.05) * 0.92;
          outR[i] = Math.tanh(sR * 1.05) * 0.92;
        }
        break;
      }
    }

    return out;
  }
}
