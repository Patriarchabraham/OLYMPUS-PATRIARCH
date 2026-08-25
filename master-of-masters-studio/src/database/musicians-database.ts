import type { SaturationType } from '../dsp/SaturationCurves';

export interface BassistSignature {
  id: string;
  name: string;
  band: string;
  gear: string;
  soundSignature: string;
  saturation: SaturationType;
  drive: number;
  eq: {
    subBassHz: number;
    subBassGainDb: number;
    growlMidHz: number;
    growlMidGainDb: number;
    clankPresenceHz: number;
    clankPresenceGainDb: number;
    airHz: number;
    airGainDb: number;
  };
}

export interface DrummerSignature {
  id: string;
  name: string;
  band: string;
  kitGear: string;
  soundSignature: string;
  saturation: SaturationType;
  drive: number;
  eq: {
    kickPunchHz: number;
    kickPunchGainDb: number;
    snareCrackHz: number;
    snareCrackGainDb: number;
    cymbalsAirHz: number;
    cymbalsAirGainDb: number;
    roomDepthDb: number;
  };
}

export const FAMOUS_BASSISTS: BassistSignature[] = [
  {
    id: 'steve_harris',
    name: 'Steve Harris',
    band: 'Iron Maiden',
    gear: 'Fender Precision Bass + Cordas Rotosound Flatwound de aço + Pré-amp Custom',
    soundSignature: 'O "Clank" mais famoso do heavy metal: ataque percussivo de dedos em 3.2kHz, graves firmes sem embolar e médios que cavalgam sobre guitarras duplas.',
    saturation: 'sansamp_di',
    drive: 0.55,
    eq: { subBassHz: 55, subBassGainDb: 3.5, growlMidHz: 800, growlMidGainDb: 2.8, clankPresenceHz: 3200, clankPresenceGainDb: 5.5, airHz: 8000, airGainDb: 2.0 },
  },
  {
    id: 'cliff_burton',
    name: 'Cliff Burton',
    band: 'Metallica (Kill \'Em All / Master of Puppets)',
    gear: 'Rickenbacker 4001 / Aria Pro II + Morley Power Wah + Electro-Harmonix Big Muff Pi',
    soundSignature: 'O mestre solista do thrash metal: distorção de fuzz massiva, médios encorpados, sustain infinito e harmônicos cortantes.',
    saturation: 'bigmuff_bass_fuzz',
    drive: 0.80,
    eq: { subBassHz: 50, subBassGainDb: 4.0, growlMidHz: 650, growlMidGainDb: 4.5, clankPresenceHz: 2800, clankPresenceGainDb: 3.8, airHz: 7500, airGainDb: 1.5 },
  },
  {
    id: 'geddy_lee',
    name: 'Geddy Lee',
    band: 'Rush',
    gear: 'Fender Jazz Bass 1972 + SansAmp RPM + Amplificadores Orange / Ampeg SVT',
    soundSignature: 'O rosnado definitivo do rock progressivo: médios-graves em 800Hz com muito calor valvulado, clareza cirúrgica de notas rápidas e agudos metálicos brilhantes.',
    saturation: 'ampeg_svt',
    drive: 0.62,
    eq: { subBassHz: 60, subBassGainDb: 3.0, growlMidHz: 850, growlMidGainDb: 4.8, clankPresenceHz: 3000, clankPresenceGainDb: 4.2, airHz: 9000, airGainDb: 3.0 },
  },
  {
    id: 'rex_brown',
    name: 'Rex Brown',
    band: 'Pantera / Down',
    gear: 'Spector NS-2 Bass com captadores EMG ativos + Ampeg SVT Classic',
    soundSignature: 'Subgrave colossal de 50Hz colado no bumbo do Vinnie Paul: peso de estado sólido e ronco agressivo que segura os solos de guitarra de Dimebag Darrell.',
    saturation: 'ampeg_svt',
    drive: 0.68,
    eq: { subBassHz: 45, subBassGainDb: 5.5, growlMidHz: 700, growlMidGainDb: 3.2, clankPresenceHz: 2500, clankPresenceGainDb: 3.5, airHz: 8000, airGainDb: 1.0 },
  },
  {
    id: 'felipe_andreoli',
    name: 'Felipe Andreoli',
    band: 'Angra / 4Action',
    gear: 'Baixo 6 Cordas Ativo D\'Mark / Ibanez + Avalon U5 DI + Darkglass B7K Ultra',
    soundSignature: 'Virtuosismo e clareza hiper-moderna: subgrave articulado para afinações pesadas, slap percussivo e agudos cristalinos sem nenhuma perda de definição.',
    saturation: 'darkglass_b7k',
    drive: 0.58,
    eq: { subBassHz: 40, subBassGainDb: 4.8, growlMidHz: 900, growlMidGainDb: 2.5, clankPresenceHz: 3400, clankPresenceGainDb: 4.8, airHz: 11000, airGainDb: 4.0 },
  },
  {
    id: 'john_myung',
    name: 'John Myung',
    band: 'Dream Theater',
    gear: 'Music Man Bongo 6 Cordas + Pré-amp Mesa Boogie M-Pulse + Ashdown',
    soundSignature: 'Precisão cirúrgica de metal progressivo: resposta ultrarrápida a palhetadas duplas e arpejos em compassos ímpares com médios controlados.',
    saturation: 'darkglass_b7k',
    drive: 0.50,
    eq: { subBassHz: 45, subBassGainDb: 4.0, growlMidHz: 750, growlMidGainDb: 3.0, clankPresenceHz: 2800, clankPresenceGainDb: 3.8, airHz: 10000, airGainDb: 3.2 },
  },
  {
    id: 'flea',
    name: 'Flea',
    band: 'Red Hot Chili Peppers',
    gear: 'Music Man StingRay / Modulus com captador Humbucker + Gallien-Krueger 800RB',
    soundSignature: 'O slap mais percussivo do rock: estalo agudo cortante, médios borbulhantes e graves elásticos que saltam para fora dos alto-falantes.',
    saturation: 'ssl_vca',
    drive: 0.45,
    eq: { subBassHz: 65, subBassGainDb: 3.8, growlMidHz: 600, growlMidGainDb: 2.0, clankPresenceHz: 2600, clankPresenceGainDb: 5.0, airHz: 9500, airGainDb: 4.2 },
  },
  {
    id: 'geezer_butler',
    name: 'Geezer Butler',
    band: 'Black Sabbath',
    gear: 'Fender Precision Bass + Válvulas Laney Supergroup / Ampeg SVT (Afinação em C#)',
    soundSignature: 'O peso obscuro do heavy metal original: graves densos valvulados, afinação rebaixada com pegada crua e saturação de fita vintage.',
    saturation: 'neve_tube',
    drive: 0.65,
    eq: { subBassHz: 50, subBassGainDb: 5.0, growlMidHz: 550, growlMidGainDb: 4.0, clankPresenceHz: 2200, clankPresenceGainDb: 2.8, airHz: 6500, airGainDb: 1.0 },
  },
  {
    id: 'billy_sheehan',
    name: 'Billy Sheehan',
    band: 'Mr. Big / The Winery Dogs / David Lee Roth',
    gear: 'Yamaha Attitude Bi-Amp System (Canal Woofer Subgrave + Canal Marshall Guitar Drive)',
    soundSignature: 'O baixo de duas saídas com técnica de tapping: subgrave sísmico de 30Hz em um canal e distorção de guitarra com harmônicos ricos no outro.',
    saturation: 'marshall_jcm800',
    drive: 0.72,
    eq: { subBassHz: 35, subBassGainDb: 6.0, growlMidHz: 1200, growlMidGainDb: 4.2, clankPresenceHz: 3800, clankPresenceGainDb: 4.5, airHz: 8500, airGainDb: 2.5 },
  },
  {
    id: 'duff_mckagan',
    name: 'Duff McKagan',
    band: 'Guns N\' Roses',
    gear: 'Fender Jazz Bass Special (PJ) + Pedal Boss CE-2B Chorus + Gallien-Krueger',
    soundSignature: 'O som brilhante e melódico do hard rock: palhetada metálica com chorus analógico sutil e médios recortados que definiram Appetite for Destruction.',
    saturation: 'ssl_vca',
    drive: 0.40,
    eq: { subBassHz: 60, subBassGainDb: 3.2, growlMidHz: 750, growlMidGainDb: 2.5, clankPresenceHz: 3000, clankPresenceGainDb: 4.8, airHz: 9000, airGainDb: 3.5 },
  },
];

export const FAMOUS_DRUMMERS: DrummerSignature[] = [
  {
    id: 'lars_ulrich',
    name: 'Lars Ulrich',
    band: 'Metallica (Black Album 1991)',
    kitGear: 'Tama Granstar II Birch + Caixa Tama Bell Brass 14x6.5" + Bumbos de 24"',
    soundSignature: 'A gravação de bateria mais imitada da história por Bob Rock: bumbo gordo em 60Hz com fita Studer, caixa explosiva e pratos Zildjian brilhantes.',
    saturation: 'tape_warmth',
    drive: 0.50,
    eq: { kickPunchHz: 60, kickPunchGainDb: 5.5, snareCrackHz: 3800, snareCrackGainDb: 5.0, cymbalsAirHz: 12000, cymbalsAirGainDb: 4.0, roomDepthDb: 3.5 },
  },
  {
    id: 'neil_peart',
    name: 'Neil Peart',
    band: 'Rush (Moving Pictures / Tom Sawyer)',
    kitGear: 'Kit Slingerland / DW Maple + Caixa Ludwig Black Beauty + Pratos Zildjian Avedis',
    soundSignature: 'Afinação melódica impecável: transientes aveludados, ressonância profunda nos tons e clareza cristalina em viradas complexas.',
    saturation: 'api_thrust',
    drive: 0.42,
    eq: { kickPunchHz: 65, kickPunchGainDb: 4.0, snareCrackHz: 4200, snareCrackGainDb: 4.5, cymbalsAirHz: 14000, cymbalsAirGainDb: 5.0, roomDepthDb: 2.8 },
  },
  {
    id: 'vinnie_paul',
    name: 'Vinnie Paul',
    band: 'Pantera (Vulgar Display of Power)',
    kitGear: 'Kit Pearl com batedores Danmar de madeira/plástico + Empirical Labs Distressor',
    soundSignature: 'O estalo de batedor de metal mais agressivo: clique em 4.5kHz com subgrave de 50Hz e caixa com compressão violenta de joelho duro.',
    saturation: 'distressor_nuke',
    drive: 0.70,
    eq: { kickPunchHz: 50, kickPunchGainDb: 6.0, snareCrackHz: 4500, snareCrackGainDb: 6.2, cymbalsAirHz: 10000, cymbalsAirGainDb: 3.0, roomDepthDb: 4.0 },
  },
  {
    id: 'nicko_mcbrain',
    name: 'Nicko McBrain',
    band: 'Iron Maiden (Powerslave / Piece of Mind)',
    kitGear: 'Kit Sonor Phonic Plus Heavy Beechwood + Caixa Sonor 14x8" + Pratos Paiste Signature',
    soundSignature: 'Pegada orgânica com pedal simples ultrarrápido: tambores profundos de faixa alemã e prato de condução Paiste Bell cortante.',
    saturation: 'tape_warmth',
    drive: 0.45,
    eq: { kickPunchHz: 70, kickPunchGainDb: 4.2, snareCrackHz: 3500, snareCrackGainDb: 4.0, cymbalsAirHz: 13000, cymbalsAirGainDb: 4.5, roomDepthDb: 3.0 },
  },
  {
    id: 'eloy_casagrande',
    name: 'Eloy Casagrande',
    band: 'Sepultura (Quadra) / Slipknot',
    kitGear: 'Kit Tama Starclassic Maple/Walnut + Caixa Tama SLP + Pratos Paiste Masters',
    soundSignature: 'A força bruta de impacto do metal moderno: rimshots ensurdecedores, bumbo duplo a 200+ BPM hiper-articulado e dinâmica cortante.',
    saturation: 'dbx160_vca',
    drive: 0.65,
    eq: { kickPunchHz: 52, kickPunchGainDb: 5.8, snareCrackHz: 4800, snareCrackGainDb: 5.8, cymbalsAirHz: 11500, cymbalsAirGainDb: 3.8, roomDepthDb: 3.8 },
  },
  {
    id: 'mike_portnoy',
    name: 'Mike Portnoy',
    band: 'Dream Theater / The Winery Dogs / Avenged Sevenfold',
    kitGear: 'Kit Tama Starclassic Monster Kit (3 Bumbos, 4 Caixas) + Pratos Sabian Custom',
    soundSignature: 'Caixa de afinação alta com estalo percussivo, bumbo articulado para pedais rápidos e separação espacial estéreo dos pratos.',
    saturation: 'ssl_vca',
    drive: 0.48,
    eq: { kickPunchHz: 58, kickPunchGainDb: 4.5, snareCrackHz: 4400, snareCrackGainDb: 4.8, cymbalsAirHz: 12500, cymbalsAirGainDb: 4.2, roomDepthDb: 3.2 },
  },
  {
    id: 'john_bonham',
    name: 'John Bonham',
    band: 'Led Zeppelin (Led Zeppelin II / IV / Physical Graffiti)',
    kitGear: 'Kit Ludwig Amber Vistalite + Bumbo de 26" sem abafamento + Caixa Supraphonic 400',
    soundSignature: 'O som de sala e reverberação mais icônico da história: bumbo acústico colossal com ressonância natural gravado em salas de pedra por Eddie Kramer.',
    saturation: 'neve_tube',
    drive: 0.58,
    eq: { kickPunchHz: 50, kickPunchGainDb: 6.5, snareCrackHz: 3000, snareCrackGainDb: 4.0, cymbalsAirHz: 9000, cymbalsAirGainDb: 2.5, roomDepthDb: 6.5 },
  },
  {
    id: 'danny_carey',
    name: 'Danny Carey',
    band: 'Tool (Lateralus / Fear Inoculum)',
    kitGear: 'Kit Sonor com casco fundido de bronze de 14mm + Pratos Paiste Signature',
    soundSignature: 'Profundidade geométrica e ressonância de metal maciço: bumbos com afinação afinada e dinâmica estéreo tridimensional.',
    saturation: 'api_thrust',
    drive: 0.52,
    eq: { kickPunchHz: 55, kickPunchGainDb: 5.0, snareCrackHz: 3900, snareCrackGainDb: 4.6, cymbalsAirHz: 13500, cymbalsAirGainDb: 4.8, roomDepthDb: 4.5 },
  },
  {
    id: 'tomas_haake',
    name: 'Tomas Haake',
    band: 'Meshuggah (Bleed / ObZen)',
    kitGear: 'Kit Sonor SQ2 Birch + Caixas customizadas de metal + Bumbos duplos calibrados',
    soundSignature: 'O padrão do bumbo duplo de velocidade e precisão métrica: clique cirúrgico em 5kHz e esteira seca para não embolar em polirritmias complexas.',
    saturation: 'ssl_vca',
    drive: 0.60,
    eq: { kickPunchHz: 48, kickPunchGainDb: 5.2, snareCrackHz: 5000, snareCrackGainDb: 5.5, cymbalsAirHz: 11000, cymbalsAirGainDb: 3.5, roomDepthDb: 2.0 },
  },
  {
    id: 'dave_grohl',
    name: 'Dave Grohl',
    band: 'Nirvana (Nevermind) / Foo Fighters / QOTSA',
    kitGear: 'Kit Tama / DW com pratos Zildjian grandes + Mesa de Som Neve 8028',
    soundSignature: 'Batida física avassaladora: compressão analógica de fita com corpo gordo de bumbo e caixa que explode no refrão.',
    saturation: 'tape_warmth',
    drive: 0.55,
    eq: { kickPunchHz: 65, kickPunchGainDb: 5.0, snareCrackHz: 3600, snareCrackGainDb: 5.2, cymbalsAirHz: 12000, cymbalsAirGainDb: 3.8, roomDepthDb: 4.2 },
  },
];
