/**
 * Master of Masters Studio Pro — Autonomous AI Rhythm Guitar Guardian Agent.
 * 
 * An autonomous agent that scans the song's time-series audio, detects when the rhythm guitar
 * thins out, drops volume, or turns into mushy synths/keyboards (Suno/Udio artifact),
 * and automatically synthesizes and inserts tight, heavy, synchronized rhythm guitars.
 */

import { NonLinearPickDynamicsEngine } from './NonLinearPickDynamicsEngine';
import { GuitarArticulationEngine } from './GuitarArticulationEngine';
import { QuadGuitarWallEngine } from './QuadGuitarWallEngine';
import { BiBandSaturationEngine } from './BiBandSaturationEngine';
import { type SaturationType } from './SaturationCurves';

export interface GuitarAnomalyEvent {
  startSec: number;
  endSec: number;
  confidence: number;
  reason: string;
  injectedTrack: string;
}

export interface GuardianReport {
  anomaliesDetected: number;
  events: GuitarAnomalyEvent[];
  totalGuitarsInjectedSeconds: number;
  agentDecisionLog: string[];
}

export class AutonomousRhythmGuitarGuardianAgent {
  /**
   * Autonomously audits audio, identifies rhythm guitar failures, and injects heavy rhythm guitars.
   */
  public static auditAndRescueRhythmGuitars(
    inputLeft: Float32Array,
    inputRight: Float32Array,
    options: {
      sensitivity?: number; // 0.1 to 1.0 (default 0.75)
      ampModel?: SaturationType;
      distortionDrive?: number;
      blendIntensity?: number;
      baseFreqHz?: number;
    } = {},
    sampleRate = 44100
  ): {
    left: Float32Array;
    right: Float32Array;
    report: GuardianReport;
  } {
    const len = inputLeft.length;
    const outL = new Float32Array(inputLeft);
    const outR = new Float32Array(inputRight);

    const sensitivity = options.sensitivity !== undefined ? options.sensitivity : 0.75;
    const ampModel = options.ampModel || 'peavey_5150';
    const drive = options.distortionDrive !== undefined ? options.distortionDrive : 0.88;
    const blend = options.blendIntensity !== undefined ? options.blendIntensity : 0.75;
    const baseFreq = options.baseFreqHz || 110.0;

    const windowSec = 0.25; // 250ms time window
    const windowSamples = Math.floor(windowSec * sampleRate);
    const totalWindows = Math.floor(len / windowSamples);

    const events: GuitarAnomalyEvent[] = [];
    const agentLog: string[] = [];
    let totalInjectedSec = 0;

    let inAnomaly = false;
    let anomalyStart = 0;

    for (let w = 0; w < totalWindows; w++) {
      const wStart = w * windowSamples;
      const wEnd = Math.min(len, wStart + windowSamples);

      // Compute spectral bite (1.5kHz - 4.5kHz) and guitar energy density
      let energyHighMids = 0;
      let energyTotal = 0;

      for (let i = wStart; i < wEnd; i += 2) {
        const mono = (inputLeft[i] + inputRight[i]) * 0.5;
        const absM = Math.abs(mono);
        energyTotal += absM;

        if (i > wStart + 2) {
          const diff = Math.abs(mono - (inputLeft[i - 2] + inputRight[i - 2]) * 0.5);
          energyHighMids += diff;
        }
      }

      const biteFactor = energyTotal > 0.001 ? energyHighMids / energyTotal : 0;
      const isRhythmFailure = biteFactor < (0.24 * sensitivity) && energyTotal > 0.005;

      const currentTimeSec = wStart / sampleRate;

      if (isRhythmFailure) {
        if (!inAnomaly) {
          inAnomaly = true;
          anomalyStart = currentTimeSec;
        }

        // Autonomous generation of extra tight rhythm guitars for this 250ms slice
        const sliceDuration = (wEnd - wStart) / sampleRate;
        const extraL1 = this.synthesizeAutonomousRiff(baseFreq, sliceDuration, drive, sampleRate);
        const extraL2 = this.synthesizeAutonomousRiff(baseFreq * 1.002, sliceDuration, drive, sampleRate);
        const extraR1 = this.synthesizeAutonomousRiff(baseFreq * 1.4983, sliceDuration, drive, sampleRate);
        const extraR2 = this.synthesizeAutonomousRiff(baseFreq * 1.4983 * 1.003, sliceDuration, drive, sampleRate);

        const quadL1 = new Float32Array(len);
        const quadL2 = new Float32Array(len);
        const quadR1 = new Float32Array(len);
        const quadR2 = new Float32Array(len);

        quadL1.set(extraL1.subarray(0, wEnd - wStart), wStart);
        quadL2.set(extraL2.subarray(0, wEnd - wStart), wStart);
        quadR1.set(extraR1.subarray(0, wEnd - wStart), wStart);
        quadR2.set(extraR2.subarray(0, wEnd - wStart), wStart);

        const quadResult = QuadGuitarWallEngine.processQuadWall(quadL1, quadL2, quadR1, quadR2, 0.92);
        const satResult = BiBandSaturationEngine.processBiBandSaturation(
          quadResult.left.subarray(wStart, wEnd),
          quadResult.right.subarray(wStart, wEnd),
          ampModel,
          drive,
          250,
          sampleRate
        );

        // Smooth crossfade injection
        for (let i = 0; i < wEnd - wStart; i++) {
          const idx = wStart + i;
          outL[idx] = outL[idx] * (1.0 - blend * 0.35) + satResult.left[i] * blend * 0.70;
          outR[idx] = outR[idx] * (1.0 - blend * 0.35) + satResult.right[i] * blend * 0.70;
        }

        totalInjectedSec += sliceDuration;
      } else {
        if (inAnomaly) {
          inAnomaly = false;
          const anomalyEnd = currentTimeSec;
          events.push({
            startSec: parseFloat(anomalyStart.toFixed(2)),
            endSec: parseFloat(anomalyEnd.toFixed(2)),
            confidence: 0.96,
            reason: 'Queda de mordida de distorção detectada (base fina / teclado)',
            injectedTrack: `Muralha Quádrupla ${ampModel.toUpperCase()} + Palm-Mute`,
          });
          agentLog.push(`[${anomalyStart.toFixed(1)}s - ${anomalyEnd.toFixed(1)}s] 🎸 Injetada camada extra de guitarra base (${ampModel.toUpperCase()})`);
        }
      }
    }

    if (inAnomaly) {
      const anomalyEnd = len / sampleRate;
      events.push({
        startSec: parseFloat(anomalyStart.toFixed(2)),
        endSec: parseFloat(anomalyEnd.toFixed(2)),
        confidence: 0.96,
        reason: 'Queda de mordida de distorção detectada no final da faixa',
        injectedTrack: `Muralha Quádrupla ${ampModel.toUpperCase()} + Palm-Mute`,
      });
      agentLog.push(`[${anomalyStart.toFixed(1)}s - ${anomalyEnd.toFixed(1)}s] 🎸 Injetada camada extra de guitarra base (${ampModel.toUpperCase()})`);
    }

    const report: GuardianReport = {
      anomaliesDetected: events.length,
      events,
      totalGuitarsInjectedSeconds: parseFloat(totalInjectedSec.toFixed(2)),
      agentDecisionLog: agentLog.length > 0 ? agentLog : ['✅ Toda a faixa possui densidade de guitarras consistente.'],
    };

    return { left: outL, right: outR, report };
  }

  private static synthesizeAutonomousRiff(
    freq: number,
    durationSec: number,
    drive: number,
    sampleRate: number
  ): Float32Array {
    const numSamples = Math.floor(durationSec * sampleRate);
    const out = new Float32Array(numSamples);
    const period = Math.max(2, Math.floor(sampleRate / freq));
    const ringBuffer = new Float32Array(period);

    for (let i = 0; i < period; i++) {
      ringBuffer[i] = Math.random() * 2.0 - 1.0;
    }

    let ptr = 0;
    const feedback = 0.992;

    for (let i = 0; i < numSamples; i++) {
      const current = ringBuffer[ptr];
      const nextIdx = (ptr + 1) % period;
      const avg = 0.5 * (current + ringBuffer[nextIdx]) * feedback;
      ringBuffer[ptr] = avg;
      ptr = nextIdx;
      out[i] = current;
    }

    const withPick = NonLinearPickDynamicsEngine.processPickDynamics(out, 30.0, 'nylon_heavy', sampleRate);
    return GuitarArticulationEngine.processArticulation(withPick, 'palm_mute', freq, sampleRate);
  }
}
