/**
 * Master of Masters Studio Pro — High-Precision 60 FPS Stereo Lissajous Goniometer
 * & Phase Correlation Vector Scope.
 * Reference: IEC 60268-10, AES Standard for Stereo Sound Stage Visualization.
 */

export class StereoGoniometer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private animFrameId: number | null = null;
  private leftAnalyser: AnalyserNode | null = null;
  private rightAnalyser: AnalyserNode | null = null;
  private leftData: Float32Array;
  private rightData: Float32Array;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not get 2D canvas context for Goniometer.');
    this.ctx = context;
    this.leftData = new Float32Array(512);
    this.rightData = new Float32Array(512);
  }

  public attachAnalysers(left: AnalyserNode, right: AnalyserNode): void {
    this.leftAnalyser = left;
    this.rightAnalyser = right;
    this.leftAnalyser.fftSize = 1024;
    this.rightAnalyser.fftSize = 1024;
    this.leftData = new Float32Array(this.leftAnalyser.fftSize);
    this.rightData = new Float32Array(this.rightAnalyser.fftSize);
    this.start();
  }

  public start(): void {
    if (this.animFrameId) return;
    const render = () => {
      this.draw();
      this.animFrameId = requestAnimationFrame(render);
    };
    this.animFrameId = requestAnimationFrame(render);
  }

  public stop(): void {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  private draw(): void {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const ctx = this.ctx;

    // Dark radar background with subtle decay persistence
    ctx.fillStyle = 'rgba(7, 10, 16, 0.25)';
    ctx.fillRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) * 0.90;

    // Draw Polar Grid & Reference Reticles
    ctx.strokeStyle = 'rgba(42, 55, 79, 0.4)';
    ctx.lineWidth = 1;

    // Circles (-6dB, -12dB, -18dB)
    [0.33, 0.66, 1.0].forEach((r) => {
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * r, 0, Math.PI * 2);
      ctx.stroke();
    });

    // M/S 45-degree Diagonal Reference Axes
    ctx.beginPath();
    ctx.moveTo(centerX - radius * 0.707, centerY - radius * 0.707);
    ctx.lineTo(centerX + radius * 0.707, centerY + radius * 0.707);
    ctx.moveTo(centerX - radius * 0.707, centerY + radius * 0.707);
    ctx.lineTo(centerX + radius * 0.707, centerY - radius * 0.707);
    ctx.stroke();

    // M (Mono / Center) and S (Side / Stereo) Axes Labels
    ctx.fillStyle = 'rgba(156, 163, 175, 0.6)';
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('+M', centerX, centerY - radius - 2);
    ctx.fillText('-M', centerX, centerY + radius + 10);
    ctx.fillText('+S (R)', centerX + radius + 12, centerY + 3);
    ctx.fillText('-S (L)', centerX - radius - 12, centerY + 3);

    if (!this.leftAnalyser || !this.rightAnalyser) return;

    this.leftAnalyser.getFloatTimeDomainData(this.leftData);
    this.rightAnalyser.getFloatTimeDomainData(this.rightData);

    const len = Math.min(this.leftData.length, this.rightData.length);
    let sumProduct = 0;
    let sumL2 = 0;
    let sumR2 = 0;

    // Lissajous Vector Plot (45-degree Mid/Side rotation)
    // x_plot = (R - L) * scale * 0.7071
    // y_plot = -(L + R) * scale * 0.7071
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.75)'; // Cyan phosphor
    ctx.lineWidth = 1.5;

    for (let i = 0; i < len; i += 2) {
      const l = this.leftData[i];
      const r = this.rightData[i];

      sumProduct += l * r;
      sumL2 += l * l;
      sumR2 += r * r;

      const mid = (l + r) * 0.7071;
      const side = (r - l) * 0.7071;

      const px = centerX + side * radius * 1.2;
      const py = centerY - mid * radius * 1.2;

      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.stroke();

    // Calculate Real-Time Phase Correlation Coefficient: [-1.0 ... +1.0]
    const denom = Math.sqrt(sumL2 * sumR2);
    const correlation = denom > 1e-9 ? sumProduct / denom : 1.0;

    // Draw Phase Correlation Bar at Bottom
    const barWidth = width * 0.7;
    const barHeight = 4;
    const barX = (width - barWidth) / 2;
    const barY = height - 12;

    ctx.fillStyle = 'rgba(28, 38, 56, 0.8)';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    // Indicator needle: -1.0 (Left/Red) to +1.0 (Right/Green)
    const normCorr = (correlation + 1.0) / 2.0; // [0.0 ... 1.0]
    const needleX = barX + normCorr * barWidth;

    const corrColor =
      correlation >= 0.5 ? '#10b981' : correlation >= 0.0 ? '#f59e0b' : '#ef4444';
    ctx.fillStyle = corrColor;
    ctx.beginPath();
    ctx.arc(needleX, barY + barHeight / 2, 4, 0, Math.PI * 2);
    ctx.fill();

    // Correlation numerical readout
    ctx.font = '8px "JetBrains Mono", monospace';
    ctx.fillText(`r: ${correlation >= 0 ? '+' : ''}${correlation.toFixed(2)}`, barX + barWidth + 16, barY + 4);
  }
}
