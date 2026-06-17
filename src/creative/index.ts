/**
 * Creative module — image + vector manipulation and generation toolkit.
 *
 * Three layers, all zero-new-dependency (raster via the existing `sharp`):
 *  - vector.ts: pure 2D vector math, affine matrices, paths/beziers, polygon
 *    boolean ops, SVG serialization.
 *  - image.ts: chainable raster pipeline over sharp (transform/filter/color/composite).
 *  - generate.ts: synthesizers — gradients, value noise, patterns (raster) and
 *    SVG shape art (vector).
 *
 * Designed as a programmable creative backbone: composable, immutable where
 * practical, fully unit-testable, honest about errors (no silent no-ops).
 */

export * from './generate.js'
export * from './image.js'
export * from './vector.js'
