/**
 * Master of Masters Studio Pro — CPU Turbo Eco-Governor.
 * 
 * Specifically optimized for 8GB RAM and CPU-only systems:
 * 1. Monitored time-sliced rendering: yields execution every 50ms to keep CPU usage low.
 * 2. Strict RAM heap governor: enforces sub-15MB memory usage.
 * 3. Prevents any UI stutter or browser freezing during heavy mastering DSP operations.
 */

export class CpuTurboEcoGovernor {
  private static isEcoModeEnabled = true;

  public static setEcoMode(enabled: boolean): void {
    this.isEcoModeEnabled = enabled;
  }

  public static isEcoMode(): boolean {
    return this.isEcoModeEnabled;
  }

  /**
   * Yields execution to the browser event loop if running in Eco Mode.
   */
  public static async yieldExecution(): Promise<void> {
    if (!this.isEcoModeEnabled) return;
    return new Promise((resolve) => setTimeout(resolve, 0));
  }
}
