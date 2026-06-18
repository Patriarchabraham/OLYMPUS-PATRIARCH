# Luxury Design Doctrine (applied by default)

The objective fundamentals of award-winning UI/UX — measured, not asserted. Luxury is discipline + restraint, NOT effect-stacking.

## What luxury actually is
- **Disciplined fundamentals:** WCAG AA+ contrast everywhere, a ratio-based type scale, a consistent spacing grid. A UI that fails these is clutter regardless of effects.
- **Restraint:** a tight palette, generous whitespace, low visual complexity. More elements/colors/motion = less luxury, not more.
- **Hierarchy:** one focal point per view; eye flows heading→subheading→body→action.
- **Purposeful motion:** short (120-360ms), purposeful curves, never decorative loops.

## What luxury is NOT (the AILEX maximalist trap)
- Glass morphism + aurora blobs + grain + 3D tilt + shimmer on EVERY element = maximalist clutter. Apply effects sparingly, only where they reinforce hierarchy.
- "Never simple" does not mean "always busy". The most awarded work is often restrained. Sophistication ≠ density.
- A "premium" score (92/100, "ultra-premium") without showing the measured contrast/scale/grid is theater.

## The measured bar (enforce before any "luxury" claim)
1. **Contrast:** every text/bg pair ≥ 4.5:1 (AA); ≥ 7:1 (AAA) for body. Compute it — never eyeball.
2. **Type scale:** consistent ratio (e.g., 1.250 major third) across all steps, within 5%.
3. **Spacing:** every value a multiple of the base grid (4px).
4. **Palette discipline:** few colors; brand + accent + neutral ramp. Color count on a screenshot is a measurable clutter signal.
5. **Complexity:** edge density on a screenshot correlates with clutter — flag when high.

## Depth, reflection, and vision for design
- **Vision = measure the pixels:** luminance, contrast stddev, edge density, color count, whitespace — all computable from the rendered output. Use `/design <screenshot>` to get a measured craft score + flags.
- **Reflection = iterate on the measured signals:** if edge density is high or whitespace low, simplify; if contrast fails a pair, fix it. Re-measure. Converge when the metrics are green — not when it "looks done".
- **Depth = fundamentals before flourish:** get contrast/scale/grid/whitespace right FIRST; layer depth/elevation/motion on top only after the fundamentals pass.

## Token system (applied by default)
Emit via `tokensToCSSVars()` — spacing grid, ratio type scale, royal-blue brand palette + gold accent, multi-level dark elevation, motion curves, radius. Generated UI imports these; it does not invent ad-hoc values. Off-grid spacing or off-ratio type is a bug.
