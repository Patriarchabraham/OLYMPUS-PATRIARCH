export class PhaseGoniometer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private analyserL: AnalyserNode | null = null;
  private analyserR: AnalyserNode | null = null;
  private animFrameId: number | null = null;
  private dataL: Float32Array | null = null;
  private dataR: Float32Array | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  public connectStereoNodes(leftAnalyser: AnalyserNode, rightAnalyser: AnalyserNode) {
    this.analyserL = leftAnalyser;
    this.analyserR = rightAnalyser;
    this.analyserL.fftSize = 512;
    this.analyserR.fftSize = 512;
    const len = this.analyserL.fftSize;
    this.dataL = new Float32Array(len);
    this.dataR = new Float32Array(len);
    this.startLoop();
  }

  public disconnect() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.analyserL = null;
    this.analyserR = null;
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
    const cx = w / 2;
    const cy = h / 2;

    ctx.clearRect(0, 0, w, h);

    // Crosshair & Circle Scope
    ctx.strokeStyle = 'rgba(75, 85, 99, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, cx * 0.85, 0, Math.PI * 2);
    ctx.stroke();

    // 45 degree diagonal axes (Mid/Side)
    ctx.beginPath();
    ctx.moveTo(cx - cx * 0.7, cy - cy * 0.7);
    ctx.lineTo(cx + cx * 0.7, cy + cy * 0.7);
    ctx.moveTo(cx - cx * 0.7, cy + cy * 0.7);
    ctx.lineTo(cx + cx * 0.7, cy - cy * 0.7);
    ctx.stroke();

    ctx.font = '9px monospace';
    ctx.fillStyle = 'rgba(156, 163, 175, 0.6)';
    ctx.fillText('+S', w - 18, cy + 3);
    ctx.fillText('-S', 4, cy + 3);
    ctx.fillText('M', cx - 4, 12);
  }

  private draw() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const ctx = this.ctx;
    const cx = w / 2;
    const cy = h / 2;

    this.drawStatic();

    if (!this.analyserL || !this.analyserR || !this.dataL || !this.dataR) return;

    this.analyserL.getFloatTimeDomainData(this.dataL);
    this.analyserR.getFloatTimeDomainData(this.dataR);

    const len = this.dataL.length;
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.85)';
    ctx.lineWidth = 1.2;

    for (let i = 0; i < len; i += 2) {
      const l = this.dataL[i];
      const r = this.dataR[i];

      // Convert Left/Right to 45-degree Mid/Side Vector Coordinates
      const m = (l + r) * 0.7071;
      const s = (l - r) * 0.7071;

      const px = cx + s * (cx * 0.8);
      const py = cy - m * (cy * 0.8);

      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
}
