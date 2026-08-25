import type { MasterAlbumSetup } from '../database/masters-database';

export class SpectrumVisualizer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private analyser: AnalyserNode | null = null;
  private animFrameId: number | null = null;
  private dataArray: Uint8Array | null = null;
  private targetAlbum: MasterAlbumSetup | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  public setTargetAlbum(album: MasterAlbumSetup) {
    this.targetAlbum = album;
    if (!this.analyser) {
      this.drawStatic();
    }
  }

  public connectAnalyser(analyser: AnalyserNode) {
    this.analyser = analyser;
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.85;
    const bufferLength = this.analyser.frequencyBinCount;
    this.dataArray = new Uint8Array(bufferLength);
    this.startLoop();
  }

  public disconnect() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.analyser = null;
    this.drawStatic();
  }

  private startLoop() {
    const render = () => {
      this.draw();
      this.animFrameId = requestAnimationFrame(render);
    };
    render();
  }

  public drawStatic() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, w, h);
    this.drawGrid(w, h);
    this.drawTargetCurve(w, h);
  }

  private draw() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, w, h);
    this.drawGrid(w, h);

    if (this.analyser && this.dataArray) {
      this.analyser.getByteFrequencyData(this.dataArray);
      const len = this.dataArray.length;

      // Realtime Spectrum Gradient
      const grad = ctx.createLinearGradient(0, h, 0, 0);
      grad.addColorStop(0, 'rgba(185, 28, 28, 0.2)');
      grad.addColorStop(0.5, 'rgba(234, 179, 8, 0.4)');
      grad.addColorStop(1, 'rgba(6, 182, 212, 0.8)');

      ctx.beginPath();
      ctx.moveTo(0, h);

      for (let i = 0; i < len; i++) {
        // Logarithmic frequency distribution
        const x = (Math.log10(i + 1) / Math.log10(len)) * w;
        const v = this.dataArray[i] / 255.0;
        const y = h - v * (h * 0.92);

        if (i === 0) ctx.lineTo(x, y);
        else ctx.lineTo(x, y);
      }

      ctx.lineTo(w, h);
      ctx.fillStyle = grad;
      ctx.fill();

      // Top line glow
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    this.drawTargetCurve(w, h);
  }

  private drawGrid(w: number, h: number) {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(55, 65, 81, 0.4)';
    ctx.lineWidth = 1;

    // Freq Grid lines & Labels
    const freqs = [
      { f: '30Hz', pos: 0.05 },
      { f: '60Hz', pos: 0.15 },
      { f: '120Hz', pos: 0.28 },
      { f: '500Hz', pos: 0.48 },
      { f: '1kHz', pos: 0.60 },
      { f: '3.5kHz', pos: 0.74 },
      { f: '8kHz', pos: 0.86 },
      { f: '16kHz', pos: 0.96 },
    ];

    freqs.forEach((item) => {
      const x = w * item.pos;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();

      ctx.font = '9px monospace';
      ctx.fillStyle = 'rgba(156, 163, 175, 0.6)';
      ctx.fillText(item.f, x - 10, h - 6);
    });

    // Horizontal dB lines
    ctx.beginPath();
    ctx.moveTo(0, h * 0.25);
    ctx.lineTo(w, h * 0.25);
    ctx.moveTo(0, h * 0.5);
    ctx.lineTo(w, h * 0.5);
    ctx.moveTo(0, h * 0.75);
    ctx.lineTo(w, h * 0.75);
    ctx.stroke();
  }

  private drawTargetCurve(w: number, h: number) {
    if (!this.targetAlbum) return;
    const ctx = this.ctx;
    const eq = this.targetAlbum.eq10Band;
    const midY = h * 0.5;

    ctx.beginPath();
    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = 'rgba(234, 179, 8, 0.8)';
    ctx.shadowBlur = 8;

    const points = [
      { x: w * 0.05, y: midY - eq.hz30 * 6 },
      { x: w * 0.15, y: midY - eq.hz60 * 6 },
      { x: w * 0.28, y: midY - eq.hz120 * 6 },
      { x: w * 0.38, y: midY - eq.hz250 * 6 },
      { x: w * 0.48, y: midY - eq.hz500 * 6 },
      { x: w * 0.60, y: midY - eq.hz1000 * 6 },
      { x: w * 0.70, y: midY - eq.hz2500 * 6 },
      { x: w * 0.78, y: midY - eq.hz4000 * 6 },
      { x: w * 0.88, y: midY - eq.hz8000 * 6 },
      { x: w * 0.98, y: midY - eq.hz16000 * 6 },
    ];

    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      const xc = (points[i].x + points[i - 1].x) / 2;
      const yc = (points[i].y + points[i - 1].y) / 2;
      ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, xc, yc);
    }
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
}
