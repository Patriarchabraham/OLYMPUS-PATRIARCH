/**
 * Master of Masters Studio Pro — Mid/Side Spatial Matrix & Mono Bass Protector (<100Hz)
 */

export function applyMidSideAndMonoBass(
  ctx: BaseAudioContext,
  inputNode: AudioNode,
  stereoWidth: number, // 0.5 (narrow) to 2.0 (ultra-wide)
  monoBassCutoffHz = 100
): AudioNode {
  // If stereoWidth is 1.0 and monoBass is not needed, we can still protect low end
  const splitter = ctx.createChannelSplitter(2);
  const merger = ctx.createChannelMerger(2);

  inputNode.connect(splitter);

  // Left & Right signals
  const leftIn = splitter;
  const rightIn = splitter;

  // Mid = (L + R) * 0.5
  // Side = (L - R) * 0.5
  const midSum = ctx.createGain();
  midSum.gain.value = 0.5;

  const rightInvert = ctx.createGain();
  rightInvert.gain.value = -1.0;

  const sideSum = ctx.createGain();
  sideSum.gain.value = 0.5 * Math.max(0.5, Math.min(2.0, stereoWidth));

  // Highpass filter on Side channel: collapses anything below cutoff (100Hz) to pure Mono!
  const sideHighpass = ctx.createBiquadFilter();
  sideHighpass.type = 'highpass';
  sideHighpass.frequency.value = monoBassCutoffHz;
  sideHighpass.Q.value = 0.7071;

  // Build Mid: Left + Right -> midSum
  leftIn.connect(midSum, 0);
  rightIn.connect(midSum, 1);

  // Build Side: Left + (-Right) -> sideSum -> sideHighpass
  leftIn.connect(sideSum, 0);
  rightIn.connect(rightInvert, 1);
  rightInvert.connect(sideSum);
  sideSum.connect(sideHighpass);

  // Reconstruct Left: Mid + SideHighpass -> merger ch 0
  // Reconstruct Right: Mid - SideHighpass -> merger ch 1
  const sideHighpassInvert = ctx.createGain();
  sideHighpassInvert.gain.value = -1.0;
  sideHighpass.connect(sideHighpassInvert);

  midSum.connect(merger, 0, 0);
  sideHighpass.connect(merger, 0, 0);

  midSum.connect(merger, 0, 1);
  sideHighpassInvert.connect(merger, 0, 1);

  return merger;
}
