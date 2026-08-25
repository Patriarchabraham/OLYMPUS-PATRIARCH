/**
 * Master of Masters Studio Pro — Vinyl & CD 4K Cover Art Generator.
 * 
 * Generates ultra-high definition album cover artwork with official gold foil
 * mastering seal certificate, band name, and analog vinyl textures.
 */

export class CoverArtGenerator {
  /**
   * Renders 4K (2048x2048 or 1024x1024) album cover art on a canvas.
   */
  public static renderCover(
    canvas: HTMLCanvasElement,
    bandName: string,
    albumTitle: string,
    producerName: string
  ): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // 1. Dark Imperial Luxury Gradient Background
    const bgGrad = ctx.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, w * 0.7);
    bgGrad.addColorStop(0, '#1a1c2e');
    bgGrad.addColorStop(0.5, '#0b0e17');
    bgGrad.addColorStop(1, '#030508');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // 2. Vinyl Grooves Subtle Rings
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    for (let r = 80; r < w * 0.45; r += 14) {
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 3. Golden Border & Frame
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = Math.max(3, Math.round(w * 0.006));
    ctx.strokeRect(w * 0.04, h * 0.04, w * 0.92, h * 0.92);

    ctx.strokeStyle = 'rgba(212, 175, 55, 0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(w * 0.05, h * 0.05, w * 0.90, h * 0.90);

    // 4. Band Name (Imperial Display Typography)
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 ${Math.round(w * 0.065)}px "Cinzel", "Outfit", sans-serif`;
    ctx.textAlign = 'center';
    ctx.shadowBlur = 20;
    ctx.shadowColor = 'rgba(212, 175, 55, 0.8)';
    ctx.fillText(bandName.toUpperCase(), w / 2, h * 0.28);

    // 5. Album Title
    ctx.fillStyle = '#fde047';
    ctx.font = `600 ${Math.round(w * 0.038)}px "Inter", sans-serif`;
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#f59e0b';
    ctx.fillText(albumTitle, w / 2, h * 0.36);
    ctx.shadowBlur = 0;

    // 6. Center Emblem / 24K Gold Mastering Seal
    const sealY = h * 0.58;
    const sealR = w * 0.14;

    ctx.beginPath();
    ctx.arc(w / 2, sealY, sealR, 0, Math.PI * 2);
    ctx.fillStyle = 'radial-gradient(circle, #fde047, #b45309)';
    ctx.fillStyle = '#111827';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#f59e0b';
    ctx.stroke();

    ctx.fillStyle = '#f59e0b';
    ctx.font = `800 ${Math.round(w * 0.018)}px "Courier New", monospace`;
    ctx.fillText('★ MASTER OF MASTERS ★', w / 2, sealY - sealR * 0.45);
    ctx.fillText('CERTIFIED 64-BIT ANALOG', w / 2, sealY - sealR * 0.15);
    ctx.fillText('QUANTUM HD MASTER', w / 2, sealY + sealR * 0.15);
    ctx.fillText('2026 EDITION', w / 2, sealY + sealR * 0.45);

    // 7. Producer Signature Footer
    ctx.fillStyle = '#94a3b8';
    ctx.font = `500 ${Math.round(w * 0.024)}px monospace`;
    ctx.fillText(`PRODUZIDO & MASTERIZADO NA ASSINATURA DE: ${producerName.toUpperCase()}`, w / 2, h * 0.88);
  }
}
