/**
 * Master of Masters Studio Pro — Interactive 10-Band EQ Curve Sculptor.
 * 
 * Draws interactive draggable frequency nodes (35Hz to 16kHz) directly on the spectrum canvas.
 */

export interface EqBandNode {
  id: string;
  freq: number;
  gainDb: number;
  label: string;
}

export class InteractiveCurveSculptor {
  private static canvas: HTMLCanvasElement | null = null;
  private static ctx: CanvasRenderingContext2D | null = null;
  private static activeDragNode: EqBandNode | null = null;
  private static onChangeCallback: ((nodes: EqBandNode[]) => void) | null = null;

  public static nodes: EqBandNode[] = [
    { id: 'hz30', freq: 35, gainDb: 0, label: '35Hz' },
    { id: 'hz60', freq: 60, gainDb: 0, label: '60Hz' },
    { id: 'hz120', freq: 120, gainDb: 0, label: '120Hz' },
    { id: 'hz250', freq: 250, gainDb: 0, label: '250Hz' },
    { id: 'hz500', freq: 500, gainDb: 0, label: '500Hz' },
    { id: 'hz1000', freq: 1000, gainDb: 0, label: '1kHz' },
    { id: 'hz2500', freq: 2500, gainDb: 0, label: '2.5kHz' },
    { id: 'hz4000', freq: 4000, gainDb: 0, label: '4kHz' },
    { id: 'hz8000', freq: 8000, gainDb: 0, label: '8kHz' },
    { id: 'hz16000', freq: 16000, gainDb: 0, label: '16kHz' },
  ];

  public static init(canvas: HTMLCanvasElement, onChange: (nodes: EqBandNode[]) => void): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onChangeCallback = onChange;

    this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    window.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    window.addEventListener('mouseup', () => this.handleMouseUp());
  }

  public static updateFromAlbum(eq10: any): void {
    if (!eq10) return;
    this.nodes.forEach(node => {
      if (eq10[node.id] !== undefined) {
        node.gainDb = eq10[node.id];
      }
    });
  }

  private static freqToX(freq: number, width: number): number {
    const minLog = Math.log10(20);
    const maxLog = Math.log10(20000);
    const freqLog = Math.log10(freq);
    return ((freqLog - minLog) / (maxLog - minLog)) * width;
  }

  private static gainToY(gainDb: number, height: number): number {
    const midY = height / 2;
    // +/-12dB range mapped across height
    return midY - (gainDb / 12.0) * (height * 0.42);
  }

  private static yToGain(y: number, height: number): number {
    const midY = height / 2;
    const norm = (midY - y) / (height * 0.42);
    return Math.max(-12.0, Math.min(12.0, Math.round(norm * 12.0 * 10) / 10));
  }

  private static handleMouseDown(e: MouseEvent): void {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    const canvasX = mouseX * scaleX;
    const canvasY = mouseY * scaleY;

    // Find nearest node
    for (const node of this.nodes) {
      const nx = this.freqToX(node.freq, this.canvas.width);
      const ny = this.gainToY(node.gainDb, this.canvas.height);
      const dist = Math.hypot(canvasX - nx, canvasY - ny);
      if (dist < 18) {
        this.activeDragNode = node;
        break;
      }
    }
  }

  private static handleMouseMove(e: MouseEvent): void {
    if (!this.activeDragNode || !this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const mouseY = (e.clientY - rect.top) * (this.canvas.height / rect.height);
    this.activeDragNode.gainDb = this.yToGain(mouseY, this.canvas.height);
    this.onChangeCallback?.(this.nodes);
  }

  private static handleMouseUp(): void {
    this.activeDragNode = null;
  }

  public static renderNodes(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Draw connecting spline curve
    ctx.beginPath();
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 2;

    for (let i = 0; i < this.nodes.length; i++) {
      const node = this.nodes[i];
      const x = this.freqToX(node.freq, width);
      const y = this.gainToY(node.gainDb, height);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Draw node handles
    for (const node of this.nodes) {
      const x = this.freqToX(node.freq, width);
      const y = this.gainToY(node.gainDb, height);

      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = node === this.activeDragNode ? '#ffffff' : '#fbbf24';
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#f59e0b';
      ctx.fill();

      // Node label
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#94a3b8';
      ctx.font = '8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(node.label, x, height - 4);
    }
  }
}
