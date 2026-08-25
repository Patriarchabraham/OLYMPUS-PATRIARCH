/**
 * Master of Masters Studio Pro — Broadcast Stereo LED PPM Peak & True-Peak Meter
 * Real-time 60 FPS multi-segment LED ladder with Green/Amber/Red/Clip indicators.
 */

export class StereoPeakMeter {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private peakL = -60;
  private peakR = -60;
  private peakHoldL = -60;
  private peakHoldR = -60;
  private peakHoldTimerL = 0;
  private peakHoldTimerR = 0;
  private isClipL = false;
  private isClipR = false;
  private clipTimer = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.draw();
  }

  /**
   * Updates the meter with current Left and Right RMS/Peak linear values (0.0 to 1.0+)
   */
  public updateLevels(linearL: number, linearR: number): void {
    const dbL = linearL > 0.00001 ? 20 * Math.log10(linearL) : -60;
    const dbR = linearR > 0.00001 ? 20 * Math.log10(linearR) : -60;

    // Smooth rise, exponential decay
    this.peakL = dbL > this.peakL ? dbL : this.peakL - 1.2;
    this.peakR = dbR > this.peakR ? dbR : this.peakR - 1.2;

    if (this.peakL < -60) this.peakL = -60;
    if (this.peakR < -60) this.peakR = -60;

    // Peak hold logic
    if (this.peakL >= this.peakHoldL) {
      this.peakHoldL = this.peakL;
      this.peakHoldTimerL = 45; // ~750ms at 60fps
    } else if (this.peakHoldTimerL > 0) {
      this.peakHoldTimerL--;
    } else {
      this.peakHoldL -= 0.6;
    }

    if (this.peakR >= this.peakHoldR) {
      this.peakHoldR = this.peakR;
      this.peakHoldTimerR = 45;
    } else if (this.peakHoldTimerR > 0) {
      this.peakHoldTimerR--;
    } else {
      this.peakHoldR -= 0.6;
    }

    // Clip detection (>= -0.1 dBFS)
    if (this.peakL >= -0.1) {
      this.isClipL = true;
      this.clipTimer = 60;
    }
    if (this.peakR >= -0.1) {
      this.isClipR = true;
      this.clipTimer = 60;
    }
    if (this.clipTimer > 0) {
      this.clipTimer--;
      if (this.clipTimer === 0) {
        this.isClipL = false;
        this.isClipR = false;
      }
    }

    this.draw();
  }

  public getPeakL(): number {
    return Math.round(this.peakL * 10) / 10;
  }

  public getPeakR(): number {
    return Math.round(this.peakR * 10) / 10;
  }

  public hasClipped(): boolean {
    return this.isClipL || this.isClipR;
  }

  public resetClip(): void {
    this.isClipL = false;
    this.isClipR = false;
    this.clipTimer = 0;
    this.peakHoldL = -60;
    this.peakHoldR = -60;
    this.draw();
  }

  private draw(): void {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const ctx = this.ctx;

    // Background chassis
    ctx.fillStyle = '#06090e';
    ctx.fillRect(0, 0, w, h);

    const isHorizontal = w > h;

    if (isHorizontal) {
      this.drawHorizontal(w, h);
    } else {
      this.drawVertical(w, h);
    }
  }

  private drawHorizontal(w: number, h: number): void {
    const ctx = this.ctx;
    const barH = (h - 18) / 2;
    const totalSegments = 36;
    const segW = (w - 65) / totalSegments;

    // dB Mapping (-60dB to +3dB)
    const minDb = -60;
    const maxDb = 3;

    // Draw Labels (L & R)
    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('L', 4, barH * 0.75 + 4);
    ctx.fillText('R', 4, barH * 1.75 + 10);

    // Render Left Bar
    this.renderHorizontalChannel(16, 3, w - 75, barH, this.peakL, this.peakHoldL, minDb, maxDb, totalSegments, segW);

    // Render Right Bar
    this.renderHorizontalChannel(16, barH + 9, w - 75, barH, this.peakR, this.peakHoldR, minDb, maxDb, totalSegments, segW);

    // Draw Clip Indicators on right
    const clipX = w - 48;
    ctx.fillStyle = this.isClipL ? '#ef4444' : '#261214';
    ctx.strokeStyle = this.isClipL ? '#f87171' : '#451a1a';
    ctx.fillRect(clipX, 3, 44, barH);
    ctx.strokeRect(clipX, 3, 44, barH);

    ctx.fillStyle = this.isClipR ? '#ef4444' : '#261214';
    ctx.strokeStyle = this.isClipR ? '#f87171' : '#451a1a';
    ctx.fillRect(clipX, barH + 9, 44, barH);
    ctx.strokeRect(clipX, barH + 9, 44, barH);

    ctx.fillStyle = (this.isClipL || this.isClipR) ? '#ffffff' : '#7f1d1d';
    ctx.font = 'bold 8px "JetBrains Mono", monospace';
    ctx.fillText('CLIP', clipX + 11, barH * 0.75 + 4);
    ctx.fillText('CLIP', clipX + 11, barH * 1.75 + 10);
  }

  private renderHorizontalChannel(
    startX: number,
    startY: number,
    totalW: number,
    barH: number,
    peakDb: number,
    peakHoldDb: number,
    minDb: number,
    maxDb: number,
    totalSegments: number,
    segW: number
  ): void {
    const ctx = this.ctx;

    for (let i = 0; i < totalSegments; i++) {
      const segDb = minDb + (i / totalSegments) * (maxDb - minDb);
      const isLit = peakDb >= segDb;
      const x = startX + i * segW;

      // Color tier calculation:
      // Green: -60dB to -18dB
      // Amber/Yellow: -18dB to -3dB
      // Orange: -3dB to -0.2dB
      // Red: > -0.2dB (Hot/Clipped)
      let colorOn = '#10b981';
      let colorOff = '#082f22';

      if (segDb >= -0.2) {
        colorOn = '#ef4444';
        colorOff = '#3b0d0d';
      } else if (segDb >= -4.0) {
        colorOn = '#f97316';
        colorOff = '#3a1a08';
      } else if (segDb >= -18.0) {
        colorOn = '#f59e0b';
        colorOff = '#2e1c04';
      }

      ctx.fillStyle = isLit ? colorOn : colorOff;
      ctx.fillRect(x, startY, segW - 1.5, barH);

      // Add slight glow to active bright segments
      if (isLit && segDb >= -6.0) {
        ctx.shadowColor = colorOn;
        ctx.shadowBlur = 4;
        ctx.fillRect(x, startY, segW - 1.5, barH);
        ctx.shadowBlur = 0;
      }
    }

    // Draw Peak Hold Line
    if (peakHoldDb > minDb) {
      const holdNorm = Math.min(1, Math.max(0, (peakHoldDb - minDb) / (maxDb - minDb)));
      const holdX = startX + holdNorm * totalW;
      ctx.fillStyle = peakHoldDb >= -0.2 ? '#f87171' : '#fbbf24';
      ctx.fillRect(holdX - 1, startY, 2, barH);
    }
  }

  private drawVertical(w: number, h: number): void {
    const ctx = this.ctx;
    const barW = (w - 18) / 2;
    const totalSegments = 40;
    const segH = (h - 25) / totalSegments;
    const minDb = -60;
    const maxDb = 3;

    // Draw L and R labels at bottom
    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('L', barW * 0.5, h - 6);
    ctx.fillText('R', barW * 1.5 + 8, h - 6);

    // Left Channel (vertical)
    this.renderVerticalChannel(4, h - 20, barW, totalSegments, segH, this.peakL, this.peakHoldL, minDb, maxDb);
    // Right Channel (vertical)
    this.renderVerticalChannel(barW + 10, h - 20, barW, totalSegments, segH, this.peakR, this.peakHoldR, minDb, maxDb);
  }

  private renderVerticalChannel(
    startX: number,
    bottomY: number,
    barW: number,
    totalSegments: number,
    segH: number,
    peakDb: number,
    peakHoldDb: number,
    minDb: number,
    maxDb: number
  ): void {
    const ctx = this.ctx;

    for (let i = 0; i < totalSegments; i++) {
      const segDb = minDb + (i / totalSegments) * (maxDb - minDb);
      const isLit = peakDb >= segDb;
      const y = bottomY - (i + 1) * segH;

      let colorOn = '#10b981';
      let colorOff = '#082f22';

      if (segDb >= -0.2) {
        colorOn = '#ef4444';
        colorOff = '#3b0d0d';
      } else if (segDb >= -4.0) {
        colorOn = '#f97316';
        colorOff = '#3a1a08';
      } else if (segDb >= -18.0) {
        colorOn = '#f59e0b';
        colorOff = '#2e1c04';
      }

      ctx.fillStyle = isLit ? colorOn : colorOff;
      ctx.fillRect(startX, y, barW, segH - 1.5);
    }
  }
}
