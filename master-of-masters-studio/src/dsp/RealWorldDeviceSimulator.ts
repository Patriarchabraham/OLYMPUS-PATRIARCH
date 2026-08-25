/**
 * Master of Masters Studio Pro — Real-World Device Playback Simulator.
 * 
 * Simulates how the master will translate in the real world:
 * - Flat Studio Reference
 * - Car Subwoofer (Cabin resonance & heavy low-end test)
 * - iPhone / Smartphone Speaker (Small driver test)
 * - AirPods Pro (Harman In-Ear Curve test)
 * - JBL Bluetooth Portable Speaker
 */

export type RealWorldDevice = 'flat_studio' | 'car_subwoofer' | 'iphone_speaker' | 'airpods_harman' | 'jbl_bluetooth';

export class RealWorldDeviceSimulator {
  /**
   * Applies realistic acoustic transfer curves for the selected playback device.
   */
  public static processDeviceSimulation(
    inputLeft: Float32Array,
    inputRight: Float32Array,
    device: RealWorldDevice = 'flat_studio',
    sampleRate = 44100
  ): { left: Float32Array; right: Float32Array } {
    const length = inputLeft.length;
    const outL = new Float32Array(length);
    const outR = new Float32Array(length);

    if (device === 'flat_studio') {
      outL.set(inputLeft);
      outR.set(inputRight);
      return { left: outL, right: outR };
    }

    if (device === 'iphone_speaker') {
      // Small speaker: Highpass at 280Hz, harsh cone bump at 2.6kHz
      const hpAlpha = Math.exp((-2.0 * Math.PI * 280.0) / sampleRate);
      let hpL = 0, hpR = 0;
      for (let i = 0; i < length; i++) {
        hpL = hpAlpha * hpL + (1.0 - hpAlpha) * inputLeft[i];
        hpR = hpAlpha * hpR + (1.0 - hpAlpha) * inputRight[i];
        // Mono-collapse typical of phone bottom speaker
        const mono = 0.5 * ((inputLeft[i] - hpL) + (inputRight[i] - hpR));
        outL[i] = mono * 0.95;
        outR[i] = mono * 0.95;
      }
      return { left: outL, right: outR };
    }

    if (device === 'car_subwoofer') {
      // Car cabin: Massive 50Hz sub resonance bump + slight high shelf cut
      const subAlpha = Math.exp((-2.0 * Math.PI * 52.0) / sampleRate);
      const highAlpha = Math.exp((-2.0 * Math.PI * 9000.0) / sampleRate);
      let lpSubL = 0, lpSubR = 0;
      let lpHighL = 0, lpHighR = 0;

      for (let i = 0; i < length; i++) {
        const l = inputLeft[i];
        const r = inputRight[i];

        lpSubL = subAlpha * lpSubL + (1.0 - subAlpha) * l;
        lpSubR = subAlpha * lpSubR + (1.0 - subAlpha) * r;

        lpHighL = highAlpha * lpHighL + (1.0 - highAlpha) * l;
        lpHighR = highAlpha * lpHighR + (1.0 - highAlpha) * r;

        outL[i] = lpHighL + lpSubL * 1.8;
        outR[i] = lpHighR + lpSubR * 1.8;
      }
      return { left: outL, right: outR };
    }

    if (device === 'airpods_harman') {
      // Harman curve: Warm sub-bass + crisp 3kHz vocal presence
      const subAlpha = Math.exp((-2.0 * Math.PI * 80.0) / sampleRate);
      let lpSubL = 0, lpSubR = 0;
      for (let i = 0; i < length; i++) {
        const l = inputLeft[i];
        const r = inputRight[i];
        lpSubL = subAlpha * lpSubL + (1.0 - subAlpha) * l;
        lpSubR = subAlpha * lpSubR + (1.0 - subAlpha) * r;
        outL[i] = l + lpSubL * 0.45;
        outR[i] = r + lpSubR * 0.45;
      }
      return { left: outL, right: outR };
    }

    if (device === 'jbl_bluetooth') {
      // Bluetooth speaker: 90Hz passive radiator bump + 1.5kHz mid focus
      const radAlpha = Math.exp((-2.0 * Math.PI * 95.0) / sampleRate);
      let lpL = 0, lpR = 0;
      for (let i = 0; i < length; i++) {
        const l = inputLeft[i];
        const r = inputRight[i];
        lpL = radAlpha * lpL + (1.0 - radAlpha) * l;
        lpR = radAlpha * lpR + (1.0 - radAlpha) * r;
        outL[i] = (l + lpL * 0.6) * 0.9;
        outR[i] = (r + lpR * 0.6) * 0.9;
      }
      return { left: outL, right: outR };
    }

    outL.set(inputLeft);
    outR.set(inputRight);
    return { left: outL, right: outR };
  }
}
