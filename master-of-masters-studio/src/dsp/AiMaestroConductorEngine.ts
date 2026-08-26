/**
 * Master of Masters Studio Pro — AI Maestro Conductor & Multi-Instrument Agent Orchestra.
 * 
 * Orchestrates a team of 6 specialized AI musical agents:
 * 1. 🎼 Maestro Conductor Agent — Writes full sheet music / scores & directs the band.
 * 2. 🎸 Virtuoso Guitarist Agent — Arranges riffs, palm-mute chugs, and twin solos.
 * 3. 🥁 Thunder Drummer Agent — Scores dynamic beats, 7ms pocket, and tom rolls.
 * 4. 🎸 Iron Bassist Agent — Scores Steve Harris 16th gallop basslines.
 * 5. 🎹 Symphonic Keyboardist Agent — Scores Hammond B3 organ & Mellotron swells.
 * 6. 🎤 Vocal Maestro Agent — Scores vocal melodies, lyric phonetics, and backing harmonies.
 */

export interface InstrumentAgentNote {
  measure: number;
  beat: number;
  noteName: string;
  tabString?: number;
  tabFret?: number;
  duration: string; // e.g. "1/4", "1/8", "1/16"
  technique?: string; // "palm-mute", "sweep", "vibrato", "ghost"
}

export interface InstrumentAgentScore {
  agentName: string;
  instrument: string;
  roleDescription: string;
  avatarIcon: string;
  agentCommentary: string;
  notes: InstrumentAgentNote[];
  asciiScoreText: string;
}

export interface MaestroOrchestraScore {
  songTitle: string;
  keySignature: string;
  tempoBpm: number;
  timeSignature: string;
  maestroDirectives: string[];
  agents: {
    guitars: InstrumentAgentScore;
    drums: InstrumentAgentScore;
    bass: InstrumentAgentScore;
    keys: InstrumentAgentScore;
    vocals: InstrumentAgentScore;
  };
  fullConductorScoreHtml: string;
}

export class AiMaestroConductorEngine {
  /**
   * Conducts the multi-agent orchestra, directs each instrument agent, and writes full scores.
   */
  public static conductScore(
    promptText: string,
    lyricsText: string,
    albumName: string,
    bpm = 145,
    key = 'E Minor'
  ): MaestroOrchestraScore {
    const timeSig = bpm >= 160 ? '4/4 (Speed Rock)' : '4/4 (Heavy Groove)';

    // 1. Maestro Directives
    const maestroDirectives = [
      `🎼 [MAESTRO CONDUÇÃO]: Estabelecendo tonalidade em ${key} e andamento em ${bpm} BPM.`,
      `🎼 [MAESTRO DINÂMICA]: Seção 1 (Intro) em pianissimo acústico com arpejos de 12 cordas.`,
      `🎼 [MAESTRO EXPLOSÃO]: Compasso 5 em fortissimo (ff) com ataque maciço de guitarras e bumbo duplo.`,
      `🎼 [MAESTRO CORO]: Compasso 13 com camadas de órgão Hammond B3 e harmonias vocais em terças.`,
      `🎼 [MAESTRO CLÍMAX]: Compasso 21 liberando duelo de guitarras em sweep picking neoclássico e viradas de tons.`,
    ];

    // 2. Guitarist Agent
    const guitarScore: InstrumentAgentScore = {
      agentName: 'Virtuoso Guitars Agent (Dave & Adrian)',
      instrument: 'Lead & Rhythm Guitars',
      roleDescription: 'Arranja riffs pesados, palm-mutes em 4 pistas e solos em terças com sweep picking',
      avatarIcon: '🎸',
      agentCommentary: 'Guitarras afinadas em Mi com amplificadores Peavey 5150 e Marshall JCM800. Executando acordes i - VI - iv - V com chug de 110Hz e solo duplo harmonizado.',
      notes: [
        { measure: 1, beat: 1, noteName: 'E2', tabString: 6, tabFret: 0, duration: '1/4', technique: 'open_chord' },
        { measure: 1, beat: 2, noteName: 'E2', tabString: 6, tabFret: 0, duration: '1/8', technique: 'palm_mute' },
        { measure: 1, beat: 3, noteName: 'G2', tabString: 6, tabFret: 3, duration: '1/8', technique: 'palm_mute' },
        { measure: 2, beat: 1, noteName: 'C3', tabString: 5, tabFret: 3, duration: '1/2', technique: 'open_chord' },
        { measure: 5, beat: 1, noteName: 'E4', tabString: 1, tabFret: 12, duration: '1/16', technique: 'sweep' },
        { measure: 5, beat: 2, noteName: 'G4', tabString: 1, tabFret: 15, duration: '1/16', technique: 'vibrato' },
      ],
      asciiScoreText: `
[GUITAR 1 - LEAD TAB]:
e|--12-15-12-------------12-15-12-------------15b17~~--|
B|-----------15-12----12----------15-12----12----------|
G|-----------------14-------------------14-------------|
D|-----------------------------------------------------|
A|-----------------------------------------------------|
E|-----------------------------------------------------|

[GUITAR 2 - RHYTHM POWERCHORDS]:
E5 (022xxx) -> C5 (x355xx) -> A5 (x022xx) -> B5 (x244xx)
PM: . . . .    . . . .       . . . .       . . . .
`,
    };

    // 3. Drummer Agent
    const drumScore: InstrumentAgentScore = {
      agentName: 'Thunder Drummer Agent (Nicko & Bonham)',
      instrument: 'Acoustic Drum Kit',
      roleDescription: 'Comanda o pulso rítmico, o recuo de 7ms de caixa (pocket) e viradas de tons',
      avatarIcon: '🥁',
      agentCommentary: 'Bumbo calibrado a 55Hz com ataque de madeira. Caixa no tempo 2 e 4 com recuo de 7ms behind-the-beat e viradas panorâmicas nos tons a cada 4 compassos.',
      notes: [
        { measure: 1, beat: 1, noteName: 'Kick + Crash', duration: '1/4', technique: 'accent' },
        { measure: 1, beat: 2, noteName: 'Snare (7ms lag)', duration: '1/4', technique: 'pocket' },
        { measure: 1, beat: 3, noteName: 'Kick Double', duration: '1/8', technique: 'double_bass' },
        { measure: 1, beat: 4, noteName: 'Snare Ghost', duration: '1/8', technique: 'ghost' },
      ],
      asciiScoreText: `
[DRUM SCORE]:
Cymbals: | X---X---X---X---| X---X---X---X---| X---X---X---X---|
Hi-Hats: | --x---x---x---x-| --x---x---x---x-| --x---x---x---x-|
Snare:   | ----o-------o---| ----o-------o---| ----o---ooooo---| (Fill)
Kick:    | o-o---o-o-o---o-| o-o---o-o-o---o-| o-o---o-o-o---o-|
`,
    };

    // 4. Bassist Agent
    const bassScore: InstrumentAgentScore = {
      agentName: 'Iron Bassist Agent (Steve Harris)',
      instrument: 'Precision Bass (Flatwound)',
      roleDescription: 'Executa a linha de baixo galopada em semicolcheias com estalo de trastes a 3.2kHz',
      avatarIcon: '🎸',
      agentCommentary: 'Fender Precision conectado ao SansAmp e Ampeg SVT. Galope em semicolcheias (Duh-Duh-Da) travando com o bumbo e sustentando os graves em 40Hz.',
      notes: [
        { measure: 1, beat: 1, noteName: 'E1', tabString: 4, tabFret: 0, duration: '1/16', technique: 'gallop' },
        { measure: 1, beat: 2, noteName: 'E1', tabString: 4, tabFret: 0, duration: '1/16', technique: 'gallop' },
        { measure: 1, beat: 3, noteName: 'B1', tabString: 3, tabFret: 2, duration: '1/16', technique: 'clank' },
        { measure: 2, beat: 1, noteName: 'C2', tabString: 3, tabFret: 3, duration: '1/16', technique: 'gallop' },
      ],
      asciiScoreText: `
[BASS TAB (STEVE HARRIS GALLOP)]:
G|-----------------------------------------------------|
D|-----------------------------------------------------|
A|---------3-3-3-3-----------------5-5-5-5-------------|
E|-0-0-0-0---------0-0-0-0-3-3-3-3---------0-0-0-0-----|
   1 e & a 2 e & a 3 e & a 4 e & a
`,
    };

    // 5. Keyboardist Agent
    const keysScore: InstrumentAgentScore = {
      agentName: 'Symphonic Keys Agent (Jon Lord & Rick Wright)',
      instrument: 'Hammond B3 Organ & Mellotron',
      roleDescription: 'Sustenta os harmônicos com rotor Leslie giratório e coro de cordas Mellotron',
      avatarIcon: '🎹',
      agentCommentary: 'Órgão Hammond B3 com registros 888000000 e rotor Leslie em 6.2Hz. Criando camadas orquestrais no refrão para dar profundidade de estádio.',
      notes: [
        { measure: 1, beat: 1, noteName: 'E Minor Pad', duration: '1/1', technique: 'leslie_fast' },
        { measure: 2, beat: 1, noteName: 'C Major String Swell', duration: '1/1', technique: 'mellotron_choir' },
      ],
      asciiScoreText: `
[HAMMOND B3 & STRINGS SCORE]:
Bar 1-4:   Em (E3-G3-B3) [Leslie Slow -> Fast Tremolo Swell]
Bar 5-8:   Cmaj (C3-E3-G3) -> Dmaj (D3-F#3-A3) [Mellotron Strings Layer]
`,
    };

    // 6. Vocal Maestro Agent
    const vocalScore: InstrumentAgentScore = {
      agentName: 'Vocal God Agent (Bruce & Dio)',
      instrument: 'Lead Vocals & Backing Choir',
      roleDescription: 'Entoa as melodias e letras com trato vocal de 32 polos, Twang e harmonias em 3ªs',
      avatarIcon: '🎤',
      agentCommentary: `Linha melódica afinada na escala de ${key}. Fonemas sincronizados com a letra: "${lyricsText ? lyricsText.slice(0, 45) : 'Into the storm we ride tonight...'}" com Twang a 2.7kHz e vibrato de 6.0Hz.`,
      notes: [
        { measure: 1, beat: 1, noteName: 'E4', duration: '1/4', technique: 'chest_resonance' },
        { measure: 1, beat: 2, noteName: 'G4', duration: '1/4', technique: 'twang_belt' },
        { measure: 1, beat: 3, noteName: 'B4', duration: '1/2', technique: 'vibrato_6hz' },
      ],
      asciiScoreText: `
[VOCAL MELODY & LYRIC PHONETICS]:
Letra:    In - to   the   storm   we   ride   to - night!
Melodia:  E4   G4    A4     B4    A4    G4    E4   E4(vib)
Harmonia: G4   B4    C5     D5    C5    B4    G4   G4 (+3ª Terça Acima)
`,
    };

    // Full HTML Conductor Score
    const fullConductorScoreHtml = `
      <div style="font-family: 'JetBrains Mono', monospace; font-size: 11px; line-height: 1.5; color: #e2e8f0; display: flex; flex-direction: column; gap: 14px;">
        <div style="background: rgba(245,158,11,0.1); border: 1px solid var(--gold-primary); padding: 12px; border-radius: 8px;">
          <h4 style="color: var(--gold-light); margin: 0 0 6px 0; font-size: 13px; text-transform: uppercase;">🎼 PARTITURA GERAL DO MAESTRO AI (FULL BAND CONDUCTOR SCORE)</h4>
          <div><strong>Música:</strong> Obra Inédita no Estilo de "${albumName}"</div>
          <div><strong>Tonalidade:</strong> ${key} | <strong>Andamento:</strong> ${bpm} BPM | <strong>Fórmula:</strong> ${timeSig}</div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 8px;">
          <strong style="color: #38bdf8;">📋 DIRETRIZES DO MAESTRO CONDUTOR:</strong>
          ${maestroDirectives.map(d => `<div style="background: rgba(0,0,0,0.3); padding: 6px 10px; border-left: 3px solid #38bdf8; border-radius: 4px;">${d}</div>`).join('')}
        </div>

        <div style="display: flex; flex-direction: column; gap: 10px;">
          <strong style="color: #ec4899;">👥 AGENTES DA BANDA VIRTUAL & PARTITURAS INDIVIDUAIS:</strong>

          <!-- GUITARS -->
          <div style="background: #080c14; border: 1px solid rgba(236,72,153,0.3); border-radius: 8px; padding: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <strong style="color: #f472b6;">🎸 ${guitarScore.agentName}</strong>
              <span style="font-size: 10px; color: #94a3b8;">${guitarScore.roleDescription}</span>
            </div>
            <p style="font-size: 10px; color: #cbd5e1; margin-bottom: 6px;">💬 <em>"${guitarScore.agentCommentary}"</em></p>
            <pre style="background: #04060a; padding: 8px; border-radius: 6px; color: #a5f3fc; overflow-x: auto; font-size: 10px;">${guitarScore.asciiScoreText}</pre>
          </div>

          <!-- DRUMS -->
          <div style="background: #080c14; border: 1px solid rgba(16,185,129,0.3); border-radius: 8px; padding: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <strong style="color: #34d399;">🥁 ${drumScore.agentName}</strong>
              <span style="font-size: 10px; color: #94a3b8;">${drumScore.roleDescription}</span>
            </div>
            <p style="font-size: 10px; color: #cbd5e1; margin-bottom: 6px;">💬 <em>"${drumScore.agentCommentary}"</em></p>
            <pre style="background: #04060a; padding: 8px; border-radius: 6px; color: #a7f3d0; overflow-x: auto; font-size: 10px;">${drumScore.asciiScoreText}</pre>
          </div>

          <!-- BASS -->
          <div style="background: #080c14; border: 1px solid rgba(56,189,248,0.3); border-radius: 8px; padding: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <strong style="color: #38bdf8;">🎸 ${bassScore.agentName}</strong>
              <span style="font-size: 10px; color: #94a3b8;">${bassScore.roleDescription}</span>
            </div>
            <p style="font-size: 10px; color: #cbd5e1; margin-bottom: 6px;">💬 <em>"${bassScore.agentCommentary}"</em></p>
            <pre style="background: #04060a; padding: 8px; border-radius: 6px; color: #bae6fd; overflow-x: auto; font-size: 10px;">${bassScore.asciiScoreText}</pre>
          </div>

          <!-- VOCALS -->
          <div style="background: #080c14; border: 1px solid rgba(245,158,11,0.3); border-radius: 8px; padding: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <strong style="color: #fbbf24;">🎤 ${vocalScore.agentName}</strong>
              <span style="font-size: 10px; color: #94a3b8;">${vocalScore.roleDescription}</span>
            </div>
            <p style="font-size: 10px; color: #cbd5e1; margin-bottom: 6px;">💬 <em>"${vocalScore.agentCommentary}"</em></p>
            <pre style="background: #04060a; padding: 8px; border-radius: 6px; color: #fde68a; overflow-x: auto; font-size: 10px;">${vocalScore.asciiScoreText}</pre>
          </div>
        </div>
      </div>
    `;

    return {
      songTitle: `Obra Inédita (${albumName})`,
      keySignature: key,
      tempoBpm: bpm,
      timeSignature: timeSig,
      maestroDirectives,
      agents: {
        guitars: guitarScore,
        drums: drumScore,
        bass: bassScore,
        keys: keysScore,
        vocals: vocalScore,
      },
      fullConductorScoreHtml,
    };
  }
}
