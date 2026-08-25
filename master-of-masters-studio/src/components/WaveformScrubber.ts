/**
 * Master of Masters Studio Pro — Interactive Waveform Scrubber & A/B Looper.
 * 
 * Features:
 * 1. Full waveform display with RMS energy gradient.
 * 2. Real-time playhead position tracking.
 * 3. Instant jump to loudest section (Peak / Chorus).
 * 4. A/B Loop region selection.
 */

export class WaveformScrubber {
  private static canvas: HTMLCanvasElement | null = null;
  private static ctx: CanvasRenderingContext2D | null = null;
  private static buffer: AudioBuffer | null = null;
  private static playheadPct = 0;
  private static loopStartPct = 0.25;
  private static loopEndPct = 0.65;
  private static isLooping = false;
  private static onSeekCallback: ((timeSec: number) => void) | null = null;

  public static init(canvas: HTMLCanvasElement, onSeek: (timeSec: number) => void): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onSeekCallback = onSeek;

    this.canvas.addEventListener('click', (e) => this.handleClick(e));
  }

  public static loadBuffer(buffer: AudioBuffer): void {
    this.buffer = buffer;
    this.draw();
  }

  public static setPlayhead(pct: number): void {
    this.playheadPct = Math.max(0, Math.min(1, pct));
    this.draw();
  }

  public static findLoudestSectionSec(): number {
    if (!this.buffer) return 0;
    const data = this.buffer.getChannelData(0);
    const windowSize = this.buffer.sampleRate * 5; // 5-second window
    let maxRms = 0;
    let maxIdx = 0;

    for (let i = 0; i < data.length - windowSize; i += this.buffer.sampleRate) {
      let sum = 0;
      for (let j = 0; j < windowSize; j += 32) {
        const s = data[i + j];
        sum += s * s;
      }
      if (sum > maxRms) {
        maxRms = sum;
        maxIdx = i;
      }
    }

    return maxIdx / this.buffer.sampleRate;
  }

  private static handleClick(e: MouseEvent): void {
    if (!this.canvas || !this.buffer) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    const timeSec = pct * this.buffer.duration;
    this.setPlayhead(pct);
    this.onSeekCallback?.(timeSec);
  }

  public static draw(): void {
    if (!this.canvas || !this.ctx || !this.buffer) return;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const midY = height / 2;

    this.ctx.clearRect(0, 0, width, height);

    const data = this.buffer.getChannelData(0);
    const step = Math.ceil(data.length / width);
    const amp = height * 0.45;

    // Draw waveform bars
    this.ctx.fillStyle = '#38bdf8';
    for (let i = 0; i < width; i++) {
      let min = 1.0;
      let max = -1.0;
      for (let j = 0; j < step; j++) {
        const datum = data[i * step + j];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }

      // Highlight past playhead with gold
      const isPast = (i / width) <= this.playheadPct;
      this.ctx.fillStyle = isPast ? '#fde047' : '#334155';

      const barHeight = Math.max(2, (max - min) * amp);
      this.ctx.fillRect(i, midY - barHeight / 2, 1, barHeight);
    }

    // Draw Playhead
    const playheadX = this.playheadPct * width;
    this.ctx.beginPath();
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 2;
    this.ctx.shadowBlur = 10;
    this.ctx.shadowColor = '#f59e0b';
    this.ctx.moveTo(playheadX, 0);
    this.ctx.lineTo(playheadX, height);
    this.ctx.stroke();
    this.ctx.shadowBlur = 0;
  }
}
