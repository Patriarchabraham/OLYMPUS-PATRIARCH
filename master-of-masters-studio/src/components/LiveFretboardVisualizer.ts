/**
 * Master of Masters Studio Pro — Live 24-Fret Guitar & Bass Visualizer.
 * 
 * Draws a real-time glowing animated 24-fret guitar and bass neck
 * highlighting string/fret fingering positions in sync with audio time.
 */

export class LiveFretboardVisualizer {
  /**
   * Draws a frame of the guitar fretboard.
   */
  public static drawFretboard(
    canvas: HTMLCanvasElement,
    currentPlaybackSec: number,
    bpm = 145
  ): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Clear background (Dark rosewood/ebony wood neck)
    ctx.fillStyle = '#0f0e14';
    ctx.fillRect(0, 0, w, h);

    const numFrets = 24;
    const numStrings = 6;
    const fretWidth = w / numFrets;
    const stringGap = h / (numStrings + 1);

    // Draw Nickel Silver Frets
    ctx.strokeStyle = 'rgba(203, 213, 225, 0.4)';
    ctx.lineWidth = 2;
    for (let f = 0; f <= numFrets; f++) {
      const x = f * fretWidth;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();

      // Fret markers (dots at 3, 5, 7, 9, 12, 15, 17, 19, 21, 24)
      if ([3, 5, 7, 9, 15, 17, 19, 21].includes(f)) {
        ctx.fillStyle = 'rgba(245, 158, 11, 0.3)';
        ctx.beginPath();
        ctx.arc(x - fretWidth / 2, h / 2, 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (f === 12 || f === 24) {
        ctx.fillStyle = 'rgba(245, 158, 11, 0.45)';
        ctx.beginPath();
        ctx.arc(x - fretWidth / 2, h / 3, 4, 0, Math.PI * 2);
        ctx.arc(x - fretWidth / 2, (h * 2) / 3, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw Steel Strings
    for (let s = 1; s <= numStrings; s++) {
      const y = s * stringGap;
      ctx.strokeStyle = `rgba(226, 232, 240, ${0.4 + (s / numStrings) * 0.4})`;
      ctx.lineWidth = 1 + (s / numStrings) * 2.5; // Thicker low strings
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Draw Animated Glowing Fingered Notes (Driven by tempo and playback)
    const secPerBeat = 60.0 / bpm;
    const beat = Math.floor(currentPlaybackSec / secPerBeat);
    const subStep = Math.floor((currentPlaybackSec / (secPerBeat / 4)) % 16);

    const activeFret = (subStep * 3) % 22 + 1;
    const activeString = (beat % numStrings) + 1;

    const noteX = activeFret * fretWidth - fretWidth / 2;
    const noteY = activeString * stringGap;

    // Glowing Neon Note Dot
    ctx.shadowColor = '#ec4899';
    ctx.shadowBlur = 15;
    ctx.fillStyle = '#f472b6';
    ctx.beginPath();
    ctx.arc(noteX, noteY, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0; // reset
  }
}
