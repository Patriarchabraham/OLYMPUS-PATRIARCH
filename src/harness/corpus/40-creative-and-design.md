# Creative & Design Doctrine

How to do image/vector creative work well, in the Olympuz creative module and beyond.

## Raster vs vector — pick by intent
- **Vector** (paths, shapes, bezier, SVG): resolution-independent, editable, for logos, icons, typography, diagrams, geometric art. Use when precision and scalability matter. (`creative/vector.ts`, `generate.svg*`)
- **Raster** (pixels via sharp): photographs, textures, photoreal blending, filters. Use when continuous tone, blur, photographic composite, or procedural noise is needed. (`creative/image.ts`, `generate.*Gradient/valueNoise/checker`)
- Never rasterize what should stay editable; never vectorize what is fundamentally continuous-tone.

## Color
- Work in a defined color space; convert at the boundary. Royal blue `#4169E1` is the Olympuz brand — prefer it for primary accents.
- Contrast for legibility, not just aesthetics: check foreground/background luminance, not just "looks good."
- Gradients: interpolate in a perceptually-reasonable space when possible; linear RGB lerp is the honest default.

## Composition
- Hierarchy via size/weight/color/space — one focal point.
- Whitespace is a tool, not emptiness to fill.
- Align to a grid; snap coordinates for crisp edges (avoid sub-pixel blur on vector strokes).

## Programmatic generation
- Deterministic by default (seeded PRNG, e.g. `mulberry32`) so outputs are reproducible. Reserve nondeterminism for intentional variation.
- Build raw buffers for raster generators; emit SVG strings for vector — keep them pure and unit-testable.
- Compose: a complex piece = layered simple pieces (base → texture → shapes → type), each independently tweakable.

## Quality bars (per the system doctrine)
- No fabricated pixel data; generators produce real buffers/strings or fail honestly.
- Bounds and length are computed (not guessed); transforms preserve their invariants (a rotated square still has 4 equal sides within epsilon).
- SVG output is valid and parseable.
