/**
 * Master of Masters Studio Pro — Live Real-Time DSP Audition Engine.
 * 
 * Allows instant live auditioning of Drum Kits, Guitar Rigs, Bass Rigs,
 * and Secret Producer Hacks on the live playback stream without re-rendering.
 */

import { DRUM_KITS, GUITAR_RIGS, BASS_RIGS } from './InstrumentKitMatrixEngine';
import { generateSaturationCurve } from './SaturationCurves';

export class LiveRigAuditionEngine {
  private static ctx: AudioContext | null = null;
  private static inputNode: MediaElementAudioSourceNode | null = null;
  private static isAuditionActive = false;

  // Real-time DSP Nodes
  private static subHpNode: BiquadFilterNode | null = null;
  private static kickThumpNode: BiquadFilterNode | null = null;
  private static snareSnapNode: BiquadFilterNode | null = null;
  private static guitarBiteNode: BiquadFilterNode | null = null;
  private static bassGrowlNode: BiquadFilterNode | null = null;
  private static airSheenNode: BiquadFilterNode | null = null;
  private static satNode: WaveShaperNode | null = null;
  private static liveGain: GainNode | null = null;

  public static init(ctx: AudioContext, sourceNode: MediaElementAudioSourceNode, destNode: AudioNode): void {
    this.ctx = ctx;
    this.inputNode = sourceNode;

    this.subHpNode = ctx.createBiquadFilter();
    this.subHpNode.type = 'highpass';
    this.subHpNode.frequency.value = 30;

    this.kickThumpNode = ctx.createBiquadFilter();
    this.kickThumpNode.type = 'peaking';
    this.kickThumpNode.frequency.value = 55;
    this.kickThumpNode.gain.value = 0;

    this.snareSnapNode = ctx.createBiquadFilter();
    this.snareSnapNode.type = 'peaking';
    this.snareSnapNode.frequency.value = 4200;
    this.snareSnapNode.gain.value = 0;

    this.guitarBiteNode = ctx.createBiquadFilter();
    this.guitarBiteNode.type = 'peaking';
    this.guitarBiteNode.frequency.value = 2400;
    this.guitarBiteNode.gain.value = 0;

    this.bassGrowlNode = ctx.createBiquadFilter();
    this.bassGrowlNode.type = 'peaking';
    this.bassGrowlNode.frequency.value = 750;
    this.bassGrowlNode.gain.value = 0;

    this.airSheenNode = ctx.createBiquadFilter();
    this.airSheenNode.type = 'highshelf';
    this.airSheenNode.frequency.value = 14000;
    this.airSheenNode.gain.value = 0;

    this.satNode = ctx.createWaveShaper();
    this.satNode.curve = generateSaturationCurve('tape', 0.1);
    this.satNode.oversample = '2x';

    this.liveGain = ctx.createGain();
    this.liveGain.gain.value = 1.0;

    // Connect node chain
    sourceNode.connect(this.subHpNode);
    this.subHpNode.connect(this.kickThumpNode);
    this.kickThumpNode.connect(this.snareSnapNode);
    this.snareSnapNode.connect(this.guitarBiteNode);
    this.guitarBiteNode.connect(this.bassGrowlNode);
    this.bassGrowlNode.connect(this.airSheenNode);
    this.airSheenNode.connect(this.satNode);
    this.satNode.connect(this.liveGain);
    this.liveGain.connect(destNode);
  }

  public static updateLiveRig(options: {
    enabled: boolean;
    drumKitId?: string;
    guitarRigId?: string;
    bassRigId?: string;
    secretHackId?: string;
  }): void {
    this.isAuditionActive = options.enabled;

    if (!this.isAuditionActive || !this.ctx) {
      // Reset all nodes to bypass/transparent
      if (this.kickThumpNode) this.kickThumpNode.gain.value = 0;
      if (this.snareSnapNode) this.snareSnapNode.gain.value = 0;
      if (this.guitarBiteNode) this.guitarBiteNode.gain.value = 0;
      if (this.bassGrowlNode) this.bassGrowlNode.gain.value = 0;
      if (this.airSheenNode) this.airSheenNode.gain.value = 0;
      return;
    }

    // Live Drum Kit Update
    if (options.drumKitId && options.drumKitId !== 'bypass') {
      const dk = DRUM_KITS.find(d => d.id === options.drumKitId);
      if (dk && this.kickThumpNode && this.snareSnapNode) {
        this.kickThumpNode.frequency.value = dk.kickThumpHz;
        this.kickThumpNode.gain.value = 3.5;
        this.snareSnapNode.frequency.value = dk.snareSnapHz;
        this.snareSnapNode.gain.value = 2.8;
      }
    } else {
      if (this.kickThumpNode) this.kickThumpNode.gain.value = 0;
      if (this.snareSnapNode) this.snareSnapNode.gain.value = 0;
    }

    // Live Guitar Rig Update
    if (options.guitarRigId && options.guitarRigId !== 'bypass') {
      const gr = GUITAR_RIGS.find(g => g.id === options.guitarRigId);
      if (gr && this.guitarBiteNode) {
        this.guitarBiteNode.frequency.value = gr.biteFreqHz;
        this.guitarBiteNode.gain.value = 3.0;
      }
    } else {
      if (this.guitarBiteNode) this.guitarBiteNode.gain.value = 0;
    }

    // Live Bass Rig Update
    if (options.bassRigId && options.bassRigId !== 'bypass') {
      const br = BASS_RIGS.find(b => b.id === options.bassRigId);
      if (br && this.bassGrowlNode) {
        this.bassGrowlNode.frequency.value = br.growlFreqHz;
        this.bassGrowlNode.gain.value = 2.5;
      }
    } else {
      if (this.bassGrowlNode) this.bassGrowlNode.gain.value = 0;
    }

    // Live Secret Hack Update
    if (options.secretHackId && options.secretHackId !== 'bypass' && this.airSheenNode) {
      if (options.secretHackId === 'max_martin_diamond') {
        this.airSheenNode.gain.value = 4.0;
      } else if (options.secretHackId === 'black_album_fatness') {
        if (this.kickThumpNode) this.kickThumpNode.gain.value = 4.5;
      }
    }
  }

  /**
   * Updates live analog saturation drive and model in real-time.
   */
  public static setSaturation(type: any, drive: number): void {
    if (!this.satNode) return;
    try {
      this.satNode.curve = generateSaturationCurve(type || 'marshall_jcm800', Math.max(0.05, drive));
    } catch {
      // Fallback
    }
  }
}
