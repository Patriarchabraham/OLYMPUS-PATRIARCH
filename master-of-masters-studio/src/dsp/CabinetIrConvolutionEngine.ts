/**
 * Master of Masters Studio Pro — Zero-Latency Cabinet IR Convolution Engine.
 * 
 * High-speed discrete convolution of legendary speaker cabinets and microphone responses.
 */

export type CabinetIrType = 'mesa_os_v30' | 'marshall_1960_greenback' | 'ampeg_svt_810' | 'fender_twin_jbl' | 'bypass';

export class CabinetIrConvolutionEngine {
  /**
   * Convolves audio channels with synthetic high-resolution cabinet impulse response.
   */
  public static processCabinetIr(
    left: Float32Array,
    right: Float32Array,
    cabType: CabinetIrType = 'mesa_os_v30',
    blend = 0.55,
    sampleRate = 44100
  ): { left: Float32Array; right: Float32Array } {
    if (cabType === 'bypass') return { left, right };

    const len = left.length;
    const outL = new Float32Array(len);
    const outR = new Float32Array(len);

    // Generate 128-point analytical acoustic impulse response
    const irLen = 128;
    const ir = new Float32Array(irLen);

    let resFreq = 110.0;
    let highCut = 5800.0;
    let midNotch = 800.0;

    switch (cabType) {
      case 'mesa_os_v30':
        resFreq = 115.0; // Deep 4x12 cab thump
        highCut = 5400.0; // V30 speaker roll-off
        midNotch = 650.0;
        break;
      case 'marshall_1960_greenback':
        resFreq = 98.0;
        highCut = 6200.0;
        midNotch = 0; // forward mids
        break;
      case 'ampeg_svt_810':
        resFreq = 52.0; // Bass punch
        highCut = 4200.0;
        midNotch = 500.0;
        break;
      case 'fender_twin_jbl':
        resFreq = 85.0;
        highCut = 7800.0;
        midNotch = 450.0;
        break;
    }

    // Build synthesized IR envelope
    const wRes = (2.0 * Math.PI * resFreq) / sampleRate;
    const wCut = (2.0 * Math.PI * highCut) / sampleRate;

    for (let t = 0; t < irLen; t++) {
      const env = Math.exp(-t / 22.0); // 22-sample exponential decay
      const tone = Math.sin(wRes * t) * 0.6 + Math.sin(wCut * t) * 0.4;
      ir[t] = env * tone;
    }

    // Normalize IR energy
    let irSum = 0;
    for (let t = 0; t < irLen; t++) irSum += Math.abs(ir[t]);
    if (irSum > 0) {
      for (let t = 0; t < irLen; t++) ir[t] /= irSum;
    }

    // Direct discrete convolution
    for (let i = 0; i < len; i++) {
      let convL = 0;
      let convR = 0;
      const maxK = Math.min(i + 1, irLen);

      for (let k = 0; k < maxK; k++) {
        convL += left[i - k] * ir[k];
        convR += right[i - k] * ir[k];
      }

      outL[i] = (1.0 - blend) * left[i] + blend * convL * 1.8;
      outR[i] = (1.0 - blend) * right[i] + blend * convR * 1.8;
    }

    return { left: outL, right: outR };
  }
}
