/**
 * Program Slicing — barrel exports.
 */

export { buildDependencyGraph, computeSlice } from './slicer.js'
export type {
	DepNode, DepEdge, DependencyKind, DependencyGraph,
	SliceCriteria, SliceResult, SlicerConfig,
} from './types.js'
export { DEFAULT_SLICER_CONFIG } from './types.js'
