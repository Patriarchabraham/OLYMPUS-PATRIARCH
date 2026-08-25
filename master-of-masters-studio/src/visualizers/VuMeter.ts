export class AnalogVuMeter {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private currentDb = -20;
  private targetDb = -20;
  private isGainReduction: boolean;

  constructor(canvas: HTMLCanvasElement, isGainReduction = false) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.isGainReduction = isGainReduction;
    this.render();
  }

  public setValue(db: number) {
    this.targetDb = db;
    // Smooth ballistics (VU meter needle inertia)
    this.currentDb += (this.targetDb - this.currentDb) * 0.25;
    this.render();
  }

  public render() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const ctx = this.ctx;
    const cx = w / 2;
    const cy = h * 1.15;
    const radius = h * 0.95;

    ctx.clearRect(0, 0, w, h);

    // Warm vintage scale background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#fbf5e6');
    bgGrad.addColorStop(1, '#e3d7b8');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Scale Arc
    ctx.strokeStyle = '#2b261f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, -Math.PI * 0.78, -Math.PI * 0.22);
    ctx.stroke();

    // Red Danger / Max GR Zone Arc
    ctx.strokeStyle = '#c5221f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, -Math.PI * 0.38, -Math.PI * 0.22);
    ctx.stroke();

    // Scale Markings & Text
    ctx.font = 'bold 9px monospace';
    ctx.fillStyle = '#2b261f';

    if (this.isGainReduction) {
      // Gain Reduction Scale: 0 to -20 dB
      const marks = [
        { db: 0, angle: -Math.PI * 0.75, label: '0' },
        { db: -3, angle: -Math.PI * 0.65, label: '-3' },
        { db: -6, angle: -Math.PI * 0.55, label: '-6' },
        { db: -10, angle: -Math.PI * 0.45, label: '-10' },
        { db: -20, angle: -Math.PI * 0.25, label: '-20' },
      ];

      marks.forEach((m) => {
        const x1 = cx + Math.cos(m.angle) * radius;
        const y1 = cy + Math.sin(m.angle) * radius;
        const x2 = cx + Math.cos(m.angle) * (radius - 8);
        const y2 = cy + Math.sin(m.angle) * (radius - 8);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        ctx.fillText(m.label, x2 - 6, y2 - 4);
      });

      ctx.fillText('GAIN REDUCTION (dB)', cx - 55, h - 8);
    } else {
      // Classic VU Scale: -20 to +3 dB
      const marks = [
        { db: -20, angle: -Math.PI * 0.75, label: '-20' },
        { db: -10, angle: -Math.PI * 0.65, label: '-10' },
        { db: -5, angle: -Math.PI * 0.52, label: '-5' },
        { db: 0, angle: -Math.PI * 0.38, label: '0' },
        { db: 3, angle: -Math.PI * 0.25, label: '+3' },
      ];

      marks.forEach((m) => {
        const x1 = cx + Math.cos(m.angle) * radius;
        const y1 = cy + Math.sin(m.angle) * radius;
        const x2 = cx + Math.cos(m.angle) * (radius - 8);
        const y2 = cy + Math.sin(m.angle) * (radius - 8);

        ctx.strokeStyle = m.db >= 0 ? '#c5221f' : '#2b261f';
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        ctx.fillStyle = m.db >= 0 ? '#c5221f' : '#2b261f';
        ctx.fillText(m.label, x2 - 8, y2 - 4);
      });

      ctx.fillStyle = '#2b261f';
      ctx.fillText('VU MASTER LEVEL', cx - 45, h - 8);
    }

    // Needle Calculation
    let needleAngle: number;
    if (this.isGainReduction) {
      // 0 dB is left (-0.75 PI), -20 dB is right (-0.25 PI)
      const clamped = Math.max(-20, Math.min(0, this.currentDb));
      const t = Math.abs(clamped) / 20;
      needleAngle = -Math.PI * 0.75 + t * (Math.PI * 0.50);
    } else {
      // -20 dB is left (-0.75 PI), +3 dB is right (-0.25 PI)
      const clamped = Math.max(-20, Math.min(3, this.currentDb));
      const t = (clamped + 20) / 23;
      needleAngle = -Math.PI * 0.75 + t * (Math.PI * 0.50);
    }

    // Draw Shadow
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + 2, cy + 2);
    ctx.lineTo(cx + Math.cos(needleAngle) * radius + 2, cy + Math.sin(needleAngle) * radius + 2);
    ctx.stroke();

    // Draw Needle
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(needleAngle) * radius, cy + Math.sin(needleAngle) * radius);
    ctx.stroke();

    // Needle Pivot Cap
    ctx.fillStyle = '#18181b';
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#71717a';
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fill();
  }
}
