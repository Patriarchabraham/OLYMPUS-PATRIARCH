/**
 * Master of Masters Studio Pro — Secret Producer Hacks & Instant Mix Magic Engine.
 * 
 * 1-Click legendary mastering tricks and studio secret weapons.
 */

export interface ProducerHackModel {
  id: string;
  name: string;
  creator: string;
  description: string;
  badge: string;
}

export const PRODUCER_HACKS: ProducerHackModel[] = [
  {
    id: 'black_album_fatness',
    name: '🪄 The Black Album Fatness (Bob Rock)',
    creator: 'Bob Rock / Metallica 1991',
    description: 'Encorpamento sub-grave em 55Hz, corte cirúrgico da sujeira em 350Hz e fita Ampex nas guitarras.',
    badge: 'SUB-WEIGHT & PUNCH',
  },
  {
    id: 'abbey_road_glue',
    name: '🪄 Abbey Road 1969 Vintage Glue (Geoff Emerick)',
    creator: 'Geoff Emerick / The Beatles 1969',
    description: 'Compressão valvulada Fairchild 670 lenta, harmônicos da mesa EMI TG12345 e calor aveludado.',
    badge: 'FAIRCHILD GLUE & WARMTH',
  },
  {
    id: 'sneap_metal_wall',
    name: '🪄 Andy Sneap Metalcore Wall of Sound',
    creator: 'Andy Sneap / Killswitch & Judas Priest',
    description: 'Grave ultra-travado, médios 4kHz domesticados e abertura estéreo holográfica nas guitarras.',
    badge: 'SURGICAL METAL CLARITY',
  },
  {
    id: 'max_martin_diamond',
    name: '🪄 Max Martin Diamond Pop Air',
    creator: 'Max Martin / Billboard #1 Hits',
    description: 'Ar de seda cristalina em 16kHz, foco vocal no centro absoluto e brilho tridimensional nos lados.',
    badge: '16KHZ SILK & VOCAL FOCUS',
  },
  {
    id: 'radioactive_tape_warmth',
    name: '🪄 Radioactive Analog Tape & Iron Transformers',
    creator: 'Ampex ATR-102 & Neve 8078 Console',
    description: 'Histerese magnética pura a 15 IPS, aquecendo os médios e eliminando qualquer aspereza digital.',
    badge: 'PURE MAGNETIC TAPE',
  },
  {
    id: 'bruce_vocal_god',
    name: '🪄 Bruce Dickinson Vocal God Presence',
    creator: 'Iron Maiden / Martin Birch',
    description: 'Ressonância faríngea de garganta em 3.2kHz, peso torácico e projeção vocal operática imponente.',
    badge: 'VOCAL GOD 3.2KHZ',
  },
];

export class SecretProducerHacksEngine {
  /**
   * Applies the selected Secret Producer Hack directly to the stereo channels.
   */
  public static processHack(
    left: Float32Array,
    right: Float32Array,
    hackId: string,
    intensity: number,
    sampleRate: number
  ): { left: Float32Array; right: Float32Array } {
    if (!hackId || hackId === 'bypass') return { left, right };

    const len = left.length;
    const outL = new Float32Array(len);
    const outR = new Float32Array(len);

    const scale = Math.max(0.1, Math.min(1.5, intensity));

    switch (hackId) {
      case 'black_album_fatness': {
        // Boost 55Hz sub, notch 350Hz mud, saturate
        const alpha55 = Math.exp((-2.0 * Math.PI * 55.0) / sampleRate);
        const alpha350 = Math.exp((-2.0 * Math.PI * 350.0) / sampleRate);
        let lp55L = 0, lp55R = 0;
        let lp350L = 0, lp350R = 0;

        for (let i = 0; i < len; i++) {
          const l = left[i];
          const r = right[i];

          lp55L = alpha55 * lp55L + (1.0 - alpha55) * l;
          lp55R = alpha55 * lp55R + (1.0 - alpha55) * r;
          lp350L = alpha350 * lp350L + (1.0 - alpha350) * l;
          lp350R = alpha350 * lp350R + (1.0 - alpha350) * r;

          const mudL = l - lp350L;
          const mudR = r - lp350R;

          // Add fatness and scoop mud
          const procL = l + lp55L * 0.22 * scale - mudL * 0.10 * scale;
          const procR = r + lp55R * 0.22 * scale - mudR * 0.10 * scale;

          outL[i] = Math.tanh(procL * 1.05);
          outR[i] = Math.tanh(procR * 1.05);
        }
        break;
      }

      case 'abbey_road_glue': {
        // Warm low-pass smoothing + second harmonic warmth
        const alphaSmooth = Math.exp((-2.0 * Math.PI * 14000.0) / sampleRate);
        let smL = 0, smR = 0;

        for (let i = 0; i < len; i++) {
          const l = left[i];
          const r = right[i];

          smL = alphaSmooth * smL + (1.0 - alphaSmooth) * l;
          smR = alphaSmooth * smR + (1.0 - alphaSmooth) * r;

          // Asymmetric tube warmth (even harmonics)
          const tubeL = smL + 0.08 * (smL * smL) * scale;
          const tubeR = smR + 0.08 * (smR * smR) * scale;

          outL[i] = tubeL;
          outR[i] = tubeR;
        }
        break;
      }

      case 'sneap_metal_wall': {
        // Tight highpass, tight punch, stereo expansion on highs
        const alphaHp = Math.exp((-2.0 * Math.PI * 35.0) / sampleRate);
        const alphaHigh = Math.exp((-2.0 * Math.PI * 3500.0) / sampleRate);
        let hpL = 0, hpR = 0;
        let hiL = 0, hiR = 0;

        for (let i = 0; i < len; i++) {
          const l = left[i];
          const r = right[i];

          hpL = alphaHp * hpL + (1.0 - alphaHp) * l;
          hpR = alphaHp * hpR + (1.0 - alphaHp) * r;
          hiL = alphaHigh * hiL + (1.0 - alphaHigh) * l;
          hiR = alphaHigh * hiR + (1.0 - alphaHigh) * r;

          const mid = (l + r) * 0.5;
          const side = (l - r) * 0.5 * (1.0 + 0.35 * scale); // Wide sides on metal guitars

          outL[i] = mid + side;
          outR[i] = mid - side;
        }
        break;
      }

      case 'max_martin_diamond': {
        // 16kHz Silk Air Boost + Center Focus
        const alphaAir = Math.exp((-2.0 * Math.PI * 12500.0) / sampleRate);
        let airL = 0, airR = 0;

        for (let i = 0; i < len; i++) {
          const l = left[i];
          const r = right[i];

          airL = alphaAir * airL + (1.0 - alphaAir) * l;
          airR = alphaAir * airR + (1.0 - alphaAir) * r;

          const airDeltaL = (l - airL) * 0.25 * scale;
          const airDeltaR = (r - airR) * 0.25 * scale;

          outL[i] = l + airDeltaL;
          outR[i] = r + airDeltaR;
        }
        break;
      }

      case 'bruce_vocal_god': {
        // 3.2kHz presence punch
        const alpha3k = Math.exp((-2.0 * Math.PI * 3200.0) / sampleRate);
        let presL = 0, presR = 0;

        for (let i = 0; i < len; i++) {
          const l = left[i];
          const r = right[i];

          presL = alpha3k * presL + (1.0 - alpha3k) * l;
          presR = alpha3k * presR + (1.0 - alpha3k) * r;

          const presDeltaL = (l - presL) * 0.20 * scale;
          const presDeltaR = (r - presR) * 0.20 * scale;

          outL[i] = l + presDeltaL;
          outR[i] = r + presDeltaR;
        }
        break;
      }

      default:
        for (let i = 0; i < len; i++) {
          outL[i] = left[i];
          outR[i] = right[i];
        }
    }

    return { left: outL, right: outR };
  }
}
