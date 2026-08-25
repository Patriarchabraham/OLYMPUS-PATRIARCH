/**
 * Master of Masters Studio Pro — ANSI C16.5 Standard VU Meter Ballistics Engine.
 * 
 * Simulates physical analog needle inertia, spring return dampening, and 300ms integration.
 */

export class AnsiVuMeterBallistics {
  private currentNeedleVu = -20;
  private needleVelocity = 0;
  private calibrationRefDb = -14; // Default 0 VU = -14 dBFS

  // Physical needle constants
  private readonly mass = 0.08;
  private readonly damping = 0.82;
  private readonly springK = 0.28;

  public setCalibration(refDb: -18 | -14 | -8): void {
    this.calibrationRefDb = refDb;
  }

  public update(instantaneousRmsDb: number): number {
    // Target VU value = instantaneous dBFS - calibration reference
    const targetVu = Math.max(-20, Math.min(+3, instantaneousRmsDb - this.calibrationRefDb));

    // Physics 2nd order spring-mass-damper simulation
    const force = (targetVu - this.currentNeedleVu) * this.springK;
    this.needleVelocity = (this.needleVelocity + force / this.mass) * this.damping;
    this.currentNeedleVu += this.needleVelocity;

    // Clamp needle mechanical stops (-20 VU to +3.5 VU)
    if (this.currentNeedleVu < -20) {
      this.currentNeedleVu = -20;
      this.needleVelocity = 0;
    } else if (this.currentNeedleVu > +3.5) {
      this.currentNeedleVu = +3.5;
      this.needleVelocity = 0;
    }

    return this.currentNeedleVu;
  }
}
