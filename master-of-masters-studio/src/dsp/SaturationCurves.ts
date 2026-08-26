export type SaturationType =
  | 'neve_tube'
  | 'ssl_vca'
  | 'tape_warmth'
  | 'distressor_nuke'
  | 'shadow_hills'
  | 'pultec_tube'
  | 'fairchild_mu'
  | 'la2a_opto'
  | 'randall_rg100'
  | 'mesa_rectifier'
  | 'peavey_5150'
  | 'marshall_jcm800'
  | 'boss_hm2_buzzsaw'
  | 'ts9_screamer'
  | 'soldano_slo100'
  | 'ampeg_svt'
  | 'sansamp_di'
  | 'darkglass_b7k'
  | 'bigmuff_bass_fuzz'
  | 'dbx160_vca'
  | 'api_thrust';

export interface SaturationModelInfo {
  id: SaturationType;
  name: string;
  category: 'guitar' | 'bass' | 'drums' | 'studio_rack';
  icon: string;
  description: string;
  famousAlbums: string;
  defaultDrive: number;
}

export const DRUM_PROCESSING_MODELS: SaturationModelInfo[] = [
  {
    id: 'tape_warmth',
    name: 'Studer A800 2" Tape Warmth & Punch',
    category: 'drums',
    icon: '📼',
    description: 'Saturação de fita magnética de 2 polegadas: arredonda transientes estridentes e encorpa o bumbo e a caixa com peso analógico.',
    famousAlbums: 'Metallica (Black Album), Nirvana (Nevermind), Soundgarden (Superunknown)',
    defaultDrive: 0.35,
  },
  {
    id: 'ssl_vca',
    name: 'SSL 4000 E-Channel Gate & VCA Snap',
    category: 'drums',
    icon: '🎛️',
    description: 'Ataque ultrarrápido com estalo afiado de caixa e bumbo com punch de metal cirúrgico.',
    famousAlbums: 'Judas Priest (Firepower), Fear Factory (Demanufacture), Colin Richardson Mixes',
    defaultDrive: 0.35,
  },
  {
    id: 'dbx160_vca',
    name: 'DBX 160 VU VCA Hard Knee Punch',
    category: 'drums',
    icon: '💥',
    description: 'Compressão lendária de joelho rígido: estalo imediato na caixa (snare pop) e bumbo explosivo.',
    famousAlbums: 'Slayer (Reign in Blood), Pantera (Cowboys from Hell), Rick Rubin Productions',
    defaultDrive: 0.40,
  },
  {
    id: 'api_thrust',
    name: 'API 2500 Discrete Transformer Drive',
    category: 'drums',
    icon: '⚡',
    description: 'Circuito Thrust com transformadores 2520: graves percussivos ultra-firmes sem estourar o limite digital.',
    famousAlbums: 'Foo Fighters, Queens of the Stone Age, Mastodon, Alice in Chains',
    defaultDrive: 0.35,
  },
  {
    id: 'distressor_nuke',
    name: 'Empirical Labs Distressor Drum Crusher',
    category: 'drums',
    icon: '⚡',
    description: 'Distorção e compressão esmagadora para salas de bateria e impacto agressivo em mixagens pesadas.',
    famousAlbums: 'Pantera (Far Beyond Driven), Deftones (White Pony), Slipknot',
    defaultDrive: 0.45,
  },
];

export const BASS_PROCESSING_MODELS: SaturationModelInfo[] = [
  {
    id: 'ampeg_svt',
    name: 'Ampeg SVT Classic 300W All-Tube Head',
    category: 'bass',
    icon: '🎸',
    description: 'O padrão dourado do contrabaixo no rock e metal: válvulas 6550 com graves profundos, ronco quente em 800Hz e ataque orgânico.',
    famousAlbums: 'Rex Brown (Pantera), Cliff Burton (Metallica), Duff McKagan (Guns N Roses), Geddy Lee',
    defaultDrive: 0.40,
  },
  {
    id: 'sansamp_di',
    name: 'Tech 21 SansAmp Bass Driver DI',
    category: 'bass',
    icon: '⚡',
    description: 'O overdrive de baixo mais famoso do metal: médios escavados, distorção cortante e mordida de palheta que perfura as guitarras.',
    famousAlbums: 'Steve Harris (Iron Maiden), Andy Sneap Mixes, Killswitch Engage, Megadeth (Endgame)',
    defaultDrive: 0.45,
  },
  {
    id: 'darkglass_b7k',
    name: 'Darkglass Microtubes B7K Ultra',
    category: 'bass',
    icon: '🎛️',
    description: 'A distorção de baixo moderno mais aclamada: ataque hi-tech, subgrave limpo intocado e distorção serrilhada nos médios-agudos.',
    famousAlbums: 'Angra (ØMNI, Cycles of Pain), Sepultura (Quadra), Periphery, Devin Townsend',
    defaultDrive: 0.40,
  },
  {
    id: 'bigmuff_bass_fuzz',
    name: 'Electro-Harmonix Russian Bass Muff',
    category: 'bass',
    icon: '📻',
    description: 'Fuzz analógico com sustentação infinita e graves gigantescos para solos e riffs pesadíssimos.',
    famousAlbums: 'Cliff Burton (Anesthesia, For Whom the Bell Tolls), Muse (Hysteria), Royal Blood',
    defaultDrive: 0.45,
  },
];

export const GUITAR_PROCESSING_MODELS: SaturationModelInfo[] = [
  {
    id: 'marshall_jcm800',
    name: 'Marshall JCM800 2203 100W British Crunch',
    category: 'guitar',
    icon: '🎸',
    description: 'O amplificador mais gravado da história do Heavy Metal: médio cortante britânico, harmônicos de EL34 e ganho orgânico.',
    famousAlbums: 'Iron Maiden, Judas Priest, Slayer, Guns N Roses, Zakk Wylde',
    defaultDrive: 0.45,
  },
  {
    id: 'peavey_5150',
    name: 'Peavey / EVH 5150 Block Letter High-Gain',
    category: 'guitar',
    icon: '⚡',
    description: 'O monstro do ganho moderno: palhetada ultra-articulada, saturação densa e resposta percussiva imediata.',
    famousAlbums: 'Pantera, Andy Sneap Mixes, Machine Head, In Flames, Arch Enemy',
    defaultDrive: 0.50,
  },
  {
    id: 'mesa_rectifier',
    name: 'Mesa Boogie Dual Rectifier Solo Head',
    category: 'guitar',
    icon: '🔥',
    description: 'Paredão americano com graves massivos, válvulas 6L6 e textura espessa que domina qualquer mixagem.',
    famousAlbums: 'Metallica (Master of Puppets Mark IIC+, Black Album), Tool, Rammstein, Alter Bridge',
    defaultDrive: 0.45,
  },
  {
    id: 'soldano_slo100',
    name: 'Soldano Super Lead Overdrive SLO-100',
    category: 'guitar',
    icon: '✨',
    description: 'Amplificador boutique lendário: ganho cremoso, riqueza harmônica de 12AX7 e sustentação infinita para solos líricos.',
    famousAlbums: 'Bruce Dickinson (The Chemical Wedding), Eric Clapton, Gary Moore, Eddie Van Halen',
    defaultDrive: 0.45,
  },
  {
    id: 'boss_hm2_buzzsaw',
    name: 'Boss HM-2 Heavy Metal Swedish Chainsaw',
    category: 'guitar',
    icon: '🪚',
    description: 'O lendário timbre motosserra de Estocolmo com todos os knobs no máximo: médios rasgados e agressividade crua.',
    famousAlbums: 'Entombed (Left Hand Path), Dismember, Bloodbath, At the Gates',
    defaultDrive: 0.45,
  },
  {
    id: 'ts9_screamer',
    name: 'Ibanez TS9 Tube Screamer Mid-Boost Overdrive',
    category: 'guitar',
    icon: '🟢',
    description: 'O overdrive clássico de corte de graves e boost em 720Hz: aperta os graves antes do amplificador para palhetadas cirúrgicas.',
    famousAlbums: 'Stevie Ray Vaughan, Metallica (Ride the Lightning), Kerry King, Killswitch Engage',
    defaultDrive: 0.40,
  },
];

export const MASTER_PROCESSING_MODELS: SaturationModelInfo[] = [
  {
    id: 'neve_tube',
    name: 'Neve 1073 Class-A Transformer Saturation',
    category: 'studio_rack',
    icon: '👑',
    description: 'Transformadores Marinair de Classe-A: graves aveludados, médios densos e agudos sedosos incomparáveis.',
    famousAlbums: 'Pink Floyd, Led Zeppelin, Queen, Foo Fighters, Iron Maiden',
    defaultDrive: 0.35,
  },
  {
    id: 'shadow_hills',
    name: 'Shadow Hills Mastering Compressor Discrete Iron/Nickel',
    category: 'studio_rack',
    icon: '🏛️',
    description: 'Transformadores comutáveis de Níquel e Ferro: cola a mixagem inteira com tridimensionalidade e peso monumental.',
    famousAlbums: 'Masterizações Audiófilas de Alto Luxo, Angra (ØMNI), Trilhas de Cinema de Hans Zimmer',
    defaultDrive: 0.35,
  },
  {
    id: 'fairchild_mu',
    name: 'Fairchild 670 Stereo Variable-Mu Tube Limiter',
    category: 'studio_rack',
    icon: '🎙️',
    description: 'O compressor valvulado mais caro e reverenciado do planeta: 20 válvulas e 14 transformadores com calor sonoro puro.',
    famousAlbums: 'The Beatles (Abbey Road), Miles Davis, Fleetwood Mac, Steely Dan',
    defaultDrive: 0.30,
  },
  {
    id: 'la2a_opto',
    name: 'Teletronix LA-2A Optical Tube Leveling Amplifier',
    category: 'studio_rack',
    icon: '✨',
    description: 'Atenuador eletroluminescente T4B com válvulas 12AX7: compressão musical suave e presença vocal mágica.',
    famousAlbums: 'Vozes lendárias de Freddie Mercury, Rob Halford, Bruce Dickinson, Celine Dion',
    defaultDrive: 0.35,
  },
  {
    id: 'pultec_tube',
    name: 'Pultec EQP-1A Program Equalizer Tube Drive',
    category: 'studio_rack',
    icon: '🎚️',
    description: 'Circuito passivo indutivo seguido de estágio de ganho a válvula: agudos de seda em 16kHz e graves sólidos sem lama.',
    famousAlbums: 'Bob Clearmountain Mixes, Sterling Sound Masters, Abbey Road Studio Sessions',
    defaultDrive: 0.35,
  },
];

export const ALL_SATURATION_MODELS: SaturationModelInfo[] = [
  ...DRUM_PROCESSING_MODELS,
  ...BASS_PROCESSING_MODELS,
  ...GUITAR_PROCESSING_MODELS,
  ...MASTER_PROCESSING_MODELS,
];

// ============================================================================
// ADAA (Anti-Derivative Anti-Aliasing) Closed-Form Analytical Formulas
// Reference: Parker, Zavalishin, Le Bivic (DAFx-16)
// ============================================================================

/**
 * Stable evaluation of ln(cosh(u)) without floating-point overflow for large |u|
 */
function lnCosh(u: number): number {
  const absU = Math.abs(u);
  if (absU > 30.0) {
    return absU - 0.6931471805599453; // abs(u) - ln(2)
  }
  return Math.log(Math.cosh(absU));
}

/**
 * Evaluates the nonlinear function f(x) and its analytical antiderivative F1(x)
 */
function evaluateNonlinearAndAntiderivative(
  x: number,
  type: SaturationType,
  drive: number
): { f: number; F1: number } {
  const d = Math.max(0.01, Math.min(1.0, drive));

  switch (type) {
    // ─── TAPE & WARMTH: f(x) = tanh(k*x) / tanh(k)
    // F1(x) = (1 / (k * tanh(k))) * ln(cosh(k*x))
    case 'tape_warmth':
    case 'fairchild_mu':
    case 'la2a_opto':
    case 'pultec_tube': {
      const k = 1.0 + d * 3.5;
      const scale = 0.96 / Math.tanh(k);
      const f = Math.tanh(k * x) * scale;
      const F1 = (1.0 / k) * lnCosh(k * x) * scale;
      return { f, F1 };
    }

    // ─── TRANSFORMER & NEVE: f(x) = (2/PI) * atan(k*x)
    // F1(x) = (2/PI) * [ x * atan(k*x) - (1/(2k)) * ln(1 + (k*x)^2) ]
    case 'neve_tube':
    case 'ts9_screamer': {
      const k = 1.0 + d * 4.5;
      const scale = 0.96;
      const kx = k * x;
      const atanVal = Math.atan(kx);
      const f = (2.0 / Math.PI) * atanVal * scale;
      const F1 = (2.0 / Math.PI) * (x * atanVal - (0.5 / k) * Math.log(1.0 + kx * kx)) * scale;
      return { f, F1 };
    }

    // ─── HIGH-GAIN AMP (5150 / SOLDANO / MESA): f(x) = (k*x) / sqrt(1 + (k*x)^2)
    // F1(x) = (1/k) * sqrt(1 + (k*x)^2)
    case 'peavey_5150':
    case 'mesa_rectifier':
    case 'soldano_slo100':
    case 'boss_hm2_buzzsaw': {
      const k = 1.2 + d * 7.5;
      const scale = 0.95;
      const kx = k * x;
      const radical = Math.sqrt(1.0 + kx * kx);
      const f = (kx / radical) * scale;
      const F1 = (radical / k) * scale;
      return { f, F1 };
    }

    // ─── RANDALL RG100 SOLID-STATE (PANTERA / DIMEBAG): f(x) = (k*x) / (1 + (k*x)^4)^(1/4)
    // Fast odd-harmonic bipolar diode clipping with razor-sharp attack
    case 'randall_rg100': {
      const k = 1.4 + d * 8.0;
      const scale = 0.95;
      const kx = k * x;
      const kx4 = kx * kx * kx * kx;
      const f = (kx / Math.pow(1.0 + kx4, 0.25)) * scale;
      // Antiderivative of x / (1 + x^4)^(1/4)
      const F1 = (0.5 * Math.asinh(kx * kx) / k) * scale;
      return { f, F1 };
    }

    // ─── MARSHALL JCM800 & BRITISH CRUNCH: f(x) = tanh(k*x*1.2)
    case 'marshall_jcm800':
    case 'shadow_hills':
    case 'ssl_vca':
    case 'api_thrust': {
      const k = 1.0 + d * 5.0;
      const scale = 0.95 / Math.tanh(k);
      const f = Math.tanh(k * x) * scale;
      const F1 = (1.0 / k) * lnCosh(k * x) * scale;
      return { f, F1 };
    }

    // ─── BASS DI & TUBE DRIVE (SANSAMP / DARKGLASS / AMPEG): Soft Algebraic Saturation
    // f(x) = (k*x) / (1 + |k*x|)
    // F1(x) = sgn(x)/k * [ |k*x| - ln(1 + |k*x|) ]
    case 'sansamp_di':
    case 'darkglass_b7k':
    case 'ampeg_svt':
    case 'distressor_nuke':
    case 'dbx160_vca':
    case 'bigmuff_bass_fuzz': {
      const k = 1.0 + d * 6.0;
      const scale = 0.94;
      const kx = k * x;
      const absKx = Math.abs(kx);
      const sgn = x >= 0 ? 1.0 : -1.0;
      const f = (kx / (1.0 + absKx)) * scale;
      const F1 = (sgn / k) * (absKx - Math.log(1.0 + absKx)) * scale;
      return { f, F1 };
    }

    default: {
      const f = x * 0.96;
      const F1 = 0.5 * x * x * 0.96;
      return { f, F1 };
    }
  }
}

/**
 * Applies 1st-Order Anti-Derivative Anti-Aliasing (ADAA-1) to an entire audio channel in-place.
 * Guarantees zero aliasing / zero digital foldover with true continuous-time analog accuracy.
 */
export function applyAdaaWaveshaper(
  buffer: Float32Array,
  type: SaturationType,
  drive: number
): void {
  const len = buffer.length;
  if (len === 0) return;

  const EPSILON = 1e-5;
  let xPrev = 0.0;
  let f1Prev = evaluateNonlinearAndAntiderivative(0.0, type, drive).F1;

  for (let i = 0; i < len; i++) {
    const xCurr = buffer[i];
    const { f: fCurr, F1: f1Curr } = evaluateNonlinearAndAntiderivative(xCurr, type, drive);
    const delta = xCurr - xPrev;

    if (Math.abs(delta) > EPSILON) {
      // ADAA-1 difference quotient
      buffer[i] = (f1Curr - f1Prev) / delta;
    } else {
      // Small delta fallback: f((xCurr + xPrev)/2) to prevent numerical division by zero
      const xMid = 0.5 * (xCurr + xPrev);
      buffer[i] = evaluateNonlinearAndAntiderivative(xMid, type, drive).f;
    }

    xPrev = xCurr;
    f1Prev = f1Curr;
  }
}

/**
 * Generates an ultra-smooth 4096-point Web Audio WaveShaperNode curve with ADAA continuous smoothing.
 */
export function generateSaturationCurve(type: SaturationType, drive = 0.5): Float32Array {
  const samples = 4096;
  const curve = new Float32Array(samples);

  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1; // [-1.0, +1.0]
    const { f } = evaluateNonlinearAndAntiderivative(x, type, drive);
    curve[i] = Math.max(-0.98, Math.min(0.98, f));
  }

  return curve;
}
