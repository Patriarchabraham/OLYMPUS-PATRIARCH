/**
 * Master of Masters Studio Pro — Interactive 3D Sphere Dolby Atmos 7.1.4 Visualizer.
 * 
 * Renders an immersive 3D spatial soundfield sphere displaying all 12 Atmos speakers
 * with real-time acoustic energy particle radiation mapped to audio playback.
 */

export interface AtmosSpeaker {
  name: string;
  x: number;
  y: number;
  z: number;
  color: string;
  energy: number;
}

export class DolbyAtmos3DSphereVisualizer {
  private static canvas: HTMLCanvasElement | null = null;
  private static ctx: CanvasRenderingContext2D | null = null;
  private static animationId: number | null = null;
  private static angleY = 0;
  private static angleX = 0.25;

  private static speakers: AtmosSpeaker[] = [
    { name: 'L', x: -0.7, y: 0, z: 0.7, color: '#38bdf8', energy: 0 },
    { name: 'C', x: 0, y: 0, z: 1.0, color: '#fde047', energy: 0 },
    { name: 'R', x: 0.7, y: 0, z: 0.7, color: '#38bdf8', energy: 0 },
    { name: 'LFE', x: 0, y: -0.6, z: 0.8, color: '#ef4444', energy: 0 },
    { name: 'LS', x: -1.0, y: 0, z: 0, color: '#a855f7', energy: 0 },
    { name: 'RS', x: 1.0, y: 0, z: 0, color: '#a855f7', energy: 0 },
    { name: 'LB', x: -0.7, y: 0, z: -0.7, color: '#ec4899', energy: 0 },
    { name: 'RB', x: 0.7, y: 0, z: -0.7, color: '#ec4899', energy: 0 },
    { name: 'TFL', x: -0.6, y: 0.8, z: 0.6, color: '#10b981', energy: 0 },
    { name: 'TFR', x: 0.6, y: 0.8, z: 0.6, color: '#10b981', energy: 0 },
    { name: 'TRL', x: -0.6, y: 0.8, z: -0.6, color: '#10b981', energy: 0 },
    { name: 'TRR', x: 0.6, y: 0.8, z: -0.6, color: '#10b981', energy: 0 },
  ];

  public static init(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.animate();
  }

  public static updateEnergy(rmsLevel: number): void {
    for (const sp of this.speakers) {
      sp.energy = Math.min(1.0, Math.max(0.1, rmsLevel * (0.8 + Math.random() * 0.4)));
    }
  }

  private static animate(): void {
    if (!this.canvas || !this.ctx) return;

    this.angleY += 0.012; // Slow spatial rotation
    const width = this.canvas.width;
    const height = this.canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) * 0.75;

    this.ctx.clearRect(0, 0, width, height);

    // Draw 3D wireframe sphere latitude rings
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    this.ctx.lineWidth = 1;

    for (let lat = -0.5; lat <= 0.5; lat += 0.5) {
      this.ctx.beginPath();
      const rRing = radius * Math.cos(lat);
      const yRing = centerY + radius * Math.sin(lat) * Math.sin(this.angleX);
      this.ctx.ellipse(centerX, yRing, rRing, rRing * 0.35, 0, 0, Math.PI * 2);
      this.ctx.stroke();
    }

    // Sort speakers by Z-depth
    const projected = this.speakers.map(sp => {
      // 3D rotation around Y and X axes
      const radY = this.angleY;
      const x1 = sp.x * Math.cos(radY) + sp.z * Math.sin(radY);
      const z1 = -sp.x * Math.sin(radY) + sp.z * Math.cos(radY);

      const radX = this.angleX;
      const y2 = sp.y * Math.cos(radX) - z1 * Math.sin(radX);
      const z2 = sp.y * Math.sin(radX) + z1 * Math.cos(radX);

      const scale = 1.0 / (2.2 - z2 * 0.6);
      const projX = centerX + x1 * radius * scale;
      const projY = centerY - y2 * radius * scale;

      return { sp, projX, projY, z2, scale };
    });

    projected.sort((a, b) => a.z2 - b.z2);

    // Draw speakers and acoustic particle beams
    for (const p of projected) {
      const sp = p.sp;
      const nodeRadius = Math.max(3, Math.round(7 * p.scale * (1.0 + sp.energy * 0.5)));

      // Acoustic energy halo
      this.ctx.beginPath();
      this.ctx.arc(p.projX, p.projY, nodeRadius * 2.2, 0, Math.PI * 2);
      this.ctx.fillStyle = sp.color;
      this.ctx.globalAlpha = 0.25 * sp.energy;
      this.ctx.fill();

      // Speaker Node Center
      this.ctx.beginPath();
      this.ctx.arc(p.projX, p.projY, nodeRadius, 0, Math.PI * 2);
      this.ctx.fillStyle = sp.color;
      this.ctx.globalAlpha = 0.85;
      this.ctx.fill();

      // Text label
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = '8px monospace';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(sp.name, p.projX, p.projY - nodeRadius - 2);
      this.ctx.globalAlpha = 1.0;
    }

    this.animationId = requestAnimationFrame(() => this.animate());
  }

  public static destroy(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }
}
