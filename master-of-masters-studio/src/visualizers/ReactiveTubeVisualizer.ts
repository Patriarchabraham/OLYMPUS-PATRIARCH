/**
 * Master of Masters Studio Pro — Reactive 12AX7 Vacuum Tube Filament Glow Engine.
 * 
 * Dynamically pulses the filament color and heat aura in real-time based on audio playback energy.
 */

export class ReactiveTubeVisualizer {
  private static animationId: number | null = null;
  private static analyser: AnalyserNode | null = null;
  private static dataArray: Uint8Array | null = null;
  private static tubeElement: HTMLElement | null = null;

  public static init(analyser: AnalyserNode): void {
    this.analyser = analyser;
    this.tubeElement = document.getElementById('master-tube-filament');
    if (!this.tubeElement) return;

    this.analyser.fftSize = 256;
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.animate();
  }

  private static animate(): void {
    if (!this.analyser || !this.dataArray || !this.tubeElement) return;

    this.analyser.getByteFrequencyData(this.dataArray);

    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      sum += this.dataArray[i];
    }
    const avg = sum / this.dataArray.length; // 0 to 255
    const intensity = Math.min(1.0, avg / 120.0);

    // Compute thermal color and box shadow glow
    const orangeHue = 25 + Math.round(intensity * 15); // 25 (deep orange) to 40 (hot gold)
    const glowRadius = Math.round(8 + intensity * 24);
    const alpha = 0.5 + intensity * 0.5;

    this.tubeElement.style.background = `linear-gradient(180deg, #fff 0%, hsl(${orangeHue}, 100%, 55%) 50%, #f97316 100%)`;
    this.tubeElement.style.boxShadow = `0 0 ${glowRadius}px hsla(${orangeHue}, 100%, 50%, ${alpha}), 0 0 ${glowRadius * 2}px rgba(234, 88, 12, ${alpha * 0.6})`;
    this.tubeElement.style.opacity = `${0.65 + intensity * 0.35}`;

    this.animationId = requestAnimationFrame(() => this.animate());
  }

  public static destroy(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }
}
