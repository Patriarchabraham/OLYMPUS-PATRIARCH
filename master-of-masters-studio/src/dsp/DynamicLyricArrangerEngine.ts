/**
 * Master of Masters Studio Pro — Dynamic Lyric & Multi-Movement Progressive Arranger.
 * 
 * 1. Parses lyrics into Verses, Chorus, Bridge, and Outro sections.
 * 2. Structures songs into 5 epic narrative musical movements for 3:30 to 12:00 minute songs.
 * 3. Injects lyric syllable pitch melodies mapped to chord changes and harmonic scales.
 */

export interface ParsedLyricStructure {
  verses: string[];
  choruses: string[];
  bridge: string;
  outro: string;
}

export interface SongMovement {
  movementIndex: number;
  name: string;
  startBar: number;
  endBar: number;
  tempoMultiplier: number;
  feel: 'acoustic_intro' | 'heavy_verse' | 'epic_chorus' | 'prog_interlude' | 'virtuoso_solo' | 'symphonic_climax';
}

export class DynamicLyricArrangerEngine {
  /**
   * Parses raw lyrics into structural song parts.
   */
  public static parseLyrics(rawLyrics: string): ParsedLyricStructure {
    if (!rawLyrics || rawLyrics.trim().length === 0) {
      return {
        verses: [
          'Into the storm we ride tonight / Ancient sands beneath the light',
          'Breaking the chains of dark and pain / Rising through fire and acid rain',
        ],
        choruses: [
          'We scream and fight, we never die! / Sovereign kings under the sky!',
        ],
        bridge: 'Silence falls before the thunder calls...',
        outro: 'Forever sovereign, forever free!',
      };
    }

    const lines = rawLyrics.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const verses: string[] = [];
    const choruses: string[] = [];
    let bridge = '';
    let outro = '';

    let currentSection: 'verse' | 'chorus' | 'bridge' | 'outro' = 'verse';
    let currentBlock: string[] = [];

    for (const line of lines) {
      const lower = line.toLowerCase();
      if (lower.startsWith('[refrão]') || lower.startsWith('[chorus]')) {
        if (currentBlock.length > 0) {
          if (currentSection === 'verse') verses.push(currentBlock.join(' / '));
          else if (currentSection === 'chorus') choruses.push(currentBlock.join(' / '));
          currentBlock = [];
        }
        currentSection = 'chorus';
        continue;
      } else if (lower.startsWith('[verso') || lower.startsWith('[verse')) {
        if (currentBlock.length > 0) {
          if (currentSection === 'chorus') choruses.push(currentBlock.join(' / '));
          else if (currentSection === 'verse') verses.push(currentBlock.join(' / '));
          currentBlock = [];
        }
        currentSection = 'verse';
        continue;
      } else if (lower.startsWith('[ponte]') || lower.startsWith('[bridge]')) {
        if (currentBlock.length > 0) {
          verses.push(currentBlock.join(' / '));
          currentBlock = [];
        }
        currentSection = 'bridge';
        continue;
      }

      currentBlock.push(line);
    }

    if (currentBlock.length > 0) {
      if (currentSection === 'verse') verses.push(currentBlock.join(' / '));
      else if (currentSection === 'chorus') choruses.push(currentBlock.join(' / '));
      else if (currentSection === 'bridge') bridge = currentBlock.join(' / ');
    }

    if (choruses.length === 0 && verses.length > 1) {
      choruses.push(verses.pop()!);
    }

    return {
      verses: verses.length > 0 ? verses : ['Riding the wind into the dark / Leaving our indelible mark'],
      choruses: choruses.length > 0 ? choruses : ['We rise above, we claim the throne / In the hall of stone!'],
      bridge: bridge || 'The battle rages on...',
      outro: outro || 'Master of masters, sovereign and wild!',
    };
  }

  /**
   * Generates a 5-to-7 movement architectural blueprint for 3:30 to 12:00 minute songs.
   */
  public static planMovements(totalBars: number): SongMovement[] {
    if (totalBars <= 64) {
      // 3:30 min song
      return [
        { movementIndex: 1, name: 'Acoustic / Heavy Intro', startBar: 0, endBar: 8, tempoMultiplier: 1.0, feel: 'acoustic_intro' },
        { movementIndex: 2, name: 'Verso 1 & Riff Principal', startBar: 8, endBar: 24, tempoMultiplier: 1.0, feel: 'heavy_verse' },
        { movementIndex: 3, name: 'Refrão 1 Épico', startBar: 24, endBar: 36, tempoMultiplier: 1.0, feel: 'epic_chorus' },
        { movementIndex: 4, name: 'Duelo de Solos de Guitarras Gêmeas', startBar: 36, endBar: 52, tempoMultiplier: 1.0, feel: 'virtuoso_solo' },
        { movementIndex: 5, name: 'Refrão Final & Grand Finale', startBar: 52, endBar: totalBars, tempoMultiplier: 1.0, feel: 'symphonic_climax' },
      ];
    }

    // 6:00 to 12:00 min Progressive Masterpiece
    const introEnd = Math.floor(totalBars * 0.12);
    const verse1End = Math.floor(totalBars * 0.30);
    const chorus1End = Math.floor(totalBars * 0.45);
    const progInterludeEnd = Math.floor(totalBars * 0.60);
    const soloEnd = Math.floor(totalBars * 0.82);
    const climaxEnd = totalBars;

    return [
      { movementIndex: 1, name: 'Ato I: Abertura Acústica & Tensão', startBar: 0, endBar: introEnd, tempoMultiplier: 0.95, feel: 'acoustic_intro' },
      { movementIndex: 2, name: 'Ato II: Ataque Pesado & Verso 1', startBar: introEnd, endBar: verse1End, tempoMultiplier: 1.0, feel: 'heavy_verse' },
      { movementIndex: 3, name: 'Ato III: Refrão Triunfante & Órgão Hammond', startBar: verse1End, endBar: chorus1End, tempoMultiplier: 1.0, feel: 'epic_chorus' },
      { movementIndex: 4, name: 'Ato IV: Interlúdio Progressivo em 7/8', startBar: chorus1End, endBar: progInterludeEnd, tempoMultiplier: 1.05, feel: 'prog_interlude' },
      { movementIndex: 5, name: 'Ato V: Suíte de Solos Neoclássicos em Terças', startBar: progInterludeEnd, endBar: soloEnd, tempoMultiplier: 1.05, feel: 'virtuoso_solo' },
      { movementIndex: 6, name: 'Ato VI: Clímax Sinfônico com Coro a 6 Vozes', startBar: soloEnd, endBar: climaxEnd, tempoMultiplier: 1.0, feel: 'symphonic_climax' },
    ];
  }
}
