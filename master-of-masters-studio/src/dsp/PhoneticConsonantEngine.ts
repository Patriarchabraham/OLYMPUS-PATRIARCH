/**
 * Master of Masters Studio Pro — Phonetic Syllabic Consonant Burst Engine.
 * 
 * Synthesizes transient linguistic consonant attacks (/p/, /t/, /k/, /s/, /sh/)
 * mapped to the lyrics text prompt to make synthesized vocals articulate words naturally.
 */

export class PhoneticConsonantEngine {
  /**
   * Injects phonetic consonant bursts onto a vocal waveform aligned with lyric syllables.
   */
  public static injectLyricConsonants(
    left: Float32Array,
    right: Float32Array,
    lyrics: string,
    bpm: number,
    sampleRate = 44100
  ): { left: Float32Array; right: Float32Array } {
    const len = left.length;
    const outL = new Float32Array(len);
    const outR = new Float32Array(len);
    outL.set(left);
    outR.set(right);

    if (!lyrics || lyrics.trim().length === 0) return { left: outL, right: outR };

    const words = lyrics.split(/\s+/).filter(w => w.length > 0);
    const secPerBeat = 60.0 / bpm;
    const samplesPerBeat = Math.floor(secPerBeat * sampleRate);

    // Seeded noise for phonetic bursts
    let seed = 44556;
    const nextNoise = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed / 2147483647) * 2.0 - 1.0;
    };

    for (let w = 0; w < words.length; w++) {
      const word = words[w].toLowerCase();
      const wordStartSample = Math.floor(w * samplesPerBeat * 1.5);
      if (wordStartSample >= len) break;

      const firstLetter = word[0];

      // Plosive attack (/p/, /t/, /k/, /b/, /d/, /g/)
      if (['p', 't', 'k', 'b', 'd', 'g', 'c'].includes(firstLetter)) {
        const burstLen = Math.floor(sampleRate * 0.015); // 15ms plosive burst
        for (let s = 0; s < Math.min(burstLen, len - wordStartSample); s++) {
          const t = s / sampleRate;
          const burst = nextNoise() * Math.exp(-t * 250.0) * 0.25;
          outL[wordStartSample + s] += burst;
          outR[wordStartSample + s] += burst;
        }
      }

      // Sibilant attack (/s/, /sh/, /f/, /z/)
      if (['s', 'f', 'z'].includes(firstLetter) || word.startsWith('sh') || word.startsWith('ch')) {
        const sibLen = Math.floor(sampleRate * 0.035); // 35ms sibilance
        for (let s = 0; s < Math.min(sibLen, len - wordStartSample); s++) {
          const t = s / sampleRate;
          const sib = nextNoise() * Math.sin(2.0 * Math.PI * 6500.0 * t) * Math.exp(-t * 80.0) * 0.20;
          outL[wordStartSample + s] += sib;
          outR[wordStartSample + s] += sib;
        }
      }
    }

    return { left: outL, right: outR };
  }
}
