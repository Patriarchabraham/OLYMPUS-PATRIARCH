/**
 * Master of Masters Studio Pro — 3D Waterfall FFT Spectrogram Visualizer.
 * 
 * Renders cascading time-frequency energy slices in 3D perspective with
 * the golden reference album target curve overlaid in real-time.
 */

export class WaterfallSpectrogramVisualizer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private history: Float32Array[] = [];
  private maxHistory = 40;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  public pushFftFrame(fftData: Float32Array): void {
    const frame = new Float32Array(fftData.length);
    frame.set(fftData);
    this.history.unshift(frame);
    if (this.history.length > this.maxHistory) {
      this.history.pop();
    }
  }

  public render(goldReferenceCurve?: Float32Array): void {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const ctx = this.ctx;

    ctx.fillStyle = '#05070a';
    ctx.fillRect(0, 0, w, h);

    if (this.history.length === 0) return;

    const numPoints = this.history[0].length;

    // Draw cascading 3D waterfall slices (from oldest to newest)
    for (let s = this.history.length - 1; s >= 0; s--) {
      const data = this.history[s];
      const zProgress = s / this.maxHistory; // 0.0 (newest front) to 1.0 (oldest back)
      
      const yOffset = h * 0.15 + (1.0 - zProgress) * (h * 0.70);
      const scaleX = 0.70 + (1.0 - zProgress) * 0.30;
      const alpha = (1.0 - zProgress * 0.85);

      ctx.beginPath();
      for (let i = 0; i < numPoints; i++) {
        const xNorm = i / (numPoints - 1);
        const x = (w * 0.5) + (xNorm - 0.5) * (w * scaleX);
        const mag = Math.max(0, (data[i] + 90) / 90); // Normalizing -90dB to 0dB
        const y = yOffset - mag * (h * 0.35 * (1.0 - zProgress * 0.4));

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      // Neon cyan-to-purple gradient for waterfall depth
      const r = Math.round(6 + zProgress * 150);
      const g = Math.round(182 - zProgress * 100);
      const b = Math.round(212 + zProgress * 40);
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
      ctx.lineWidth = s === 0 ? 2 : 1;
      ctx.stroke();
    }

    // Overlaid Golden Master Reference Curve (Front 3D plane)
    if (goldReferenceCurve && goldReferenceCurve.length > 0) {
      ctx.beginPath();
      const numRef = goldReferenceCurve.length;
      for (let i = 0; i < numRef; i++) {
        const x = (i / (numRef - 1)) * w;
        const db = goldReferenceCurve[i];
        const y = (h * 0.50) - (db / 12.0) * (h * 0.30);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.90)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Gold Glow
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      ctx.fillText('👑 CURVA ALVO MESTRE (2048 FFT)', 10, 16);
    }
  }
}
