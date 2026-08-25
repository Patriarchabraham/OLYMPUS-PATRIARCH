/**
 * Master of Masters Studio Pro — Mastering Delivery Quality Report Engine.
 * Generates an audiophile quality assurance certificate and streaming platform compliance report.
 */

import type { AudioStats } from '../dsp/WavEncoder';

export interface PlatformCompliance {
  name: string;
  targetLufs: number;
  targetPeakDb: number;
  isCompliant: boolean;
  penaltyGainDb: number;
  statusText: string;
}

export class MasteringReport {
  public static evaluatePlatforms(stats: AudioStats): PlatformCompliance[] {
    const platforms = [
      { name: 'Spotify (Normal)', targetLufs: -14.0, targetPeakDb: -1.0 },
      { name: 'Apple Music (Sound Check)', targetLufs: -16.0, targetPeakDb: -1.0 },
      { name: 'Tidal Masters', targetLufs: -14.0, targetPeakDb: -0.5 },
      { name: 'YouTube Music', targetLufs: -14.0, targetPeakDb: -1.0 },
      { name: 'CD Audio / Loudness Club', targetLufs: -8.0, targetPeakDb: -0.2 },
      { name: 'Vinyl Disc Pressing', targetLufs: -13.0, targetPeakDb: -0.5 },
    ];

    return platforms.map((p) => {
      const penalty = stats.estimatedLufs > p.targetLufs ? p.targetLufs - stats.estimatedLufs : 0.0;
      const isCompliant = stats.peakDb <= p.targetPeakDb;
      const statusText = isCompliant
        ? penalty < 0
          ? `Normalização automática: ${penalty.toFixed(1)} dB`
          : '✓ Perfeito (Sem atenuação)'
        : `⚠️ True-Peak acima do teto de ${p.targetPeakDb} dBFS`;

      return {
        name: p.name,
        targetLufs: p.targetLufs,
        targetPeakDb: p.targetPeakDb,
        isCompliant,
        penaltyGainDb: penalty,
        statusText,
      };
    });
  }

  public static generateHtmlReport(stats: AudioStats, albumName: string, producerName: string): string {
    const platforms = this.evaluatePlatforms(stats);
    const dateStr = new Date().toLocaleDateString('pt-BR');

    return `
      <div style="font-family: var(--font-mono); font-size: 11px; color: #cbd5e1; display: flex; flex-direction: column; gap: 14px;">
        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 8px;">
          <div>
            <strong style="color: var(--gold-light); font-size: 13px; display: block;">CERTIFICADO DE MASTERIZAÇÃO AUDIÓFILA</strong>
            <span style="color: #64748b;">Mestre: ${producerName} · Referência: ${albumName}</span>
          </div>
          <span style="color: var(--cyan-light); font-weight: 700;">${dateStr}</span>
        </div>

        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; text-align: center;">
          <div style="background: #060910; padding: 8px; border-radius: 6px; border: 1px solid var(--border-subtle);">
            <span style="color: #64748b; font-size: 10px; display: block;">INTEGRATED LUFS</span>
            <strong style="color: var(--gold-light); font-size: 14px;">${stats.estimatedLufs} LUFS</strong>
          </div>
          <div style="background: #060910; padding: 8px; border-radius: 6px; border: 1px solid var(--border-subtle);">
            <span style="color: #64748b; font-size: 10px; display: block;">TRUE-PEAK</span>
            <strong style="color: var(--emerald-primary); font-size: 14px;">${stats.peakDb} dBFS</strong>
          </div>
          <div style="background: #060910; padding: 8px; border-radius: 6px; border: 1px solid var(--border-subtle);">
            <span style="color: #64748b; font-size: 10px; display: block;">CREST FACTOR (DR)</span>
            <strong style="color: var(--cyan-light); font-size: 14px;">${stats.crestFactorDb} dB</strong>
          </div>
          <div style="background: #060910; padding: 8px; border-radius: 6px; border: 1px solid var(--border-subtle);">
            <span style="color: #64748b; font-size: 10px; display: block;">DITHER & BIT DEPTH</span>
            <strong style="color: #ffffff; font-size: 13px;">TPDF 24-Bit HD</strong>
          </div>
        </div>

        <div>
          <strong style="color: #94a3b8; font-size: 11px; display: block; margin-bottom: 6px;">COMPATIBILIDADE COM PLATAFORMAS DE STREAMING:</strong>
          <div style="display: flex; flex-direction: column; gap: 4px;">
            ${platforms
              .map(
                (p) => `
              <div style="display: flex; justify-content: space-between; padding: 6px 10px; background: #05070b; border-radius: 4px; border: 1px solid rgba(255,255,255,0.05);">
                <span>${p.name}</span>
                <span style="color: ${p.penaltyGainDb === 0 ? 'var(--emerald-primary)' : 'var(--gold-light)'}; font-weight: 700;">${p.statusText}</span>
              </div>
            `
              )
              .join('')}
          </div>
        </div>
      </div>
    `;
  }
}
