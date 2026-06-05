/**
 * Program Slicing types — reduce code to what affects a specific criterion.
 */

/** Type of dependency edge */
export type DependencyKind = 'data' | 'control' | 'call'

/** A node in the dependency graph */
export interface DepNode {
	/** Unique ID */
	id: string
	/** Type of node */
	type: 'variable' | 'statement' | 'parameter' | 'return'
	/** Variable name (if applicable) */
	variableName: string | null
	/** Line number */
	lineNumber: number
	/** Column (character position) */
	column: number
	/** The source text of this node */
	text: string
}

/** A dependency edge between nodes */
export interface DepEdge {
	/** Source node ID */
	from: string
	/** Target node ID */
	to: string
	/** Dependency kind */
	kind: DependencyKind
}

/** The dependency graph for a source file */
export interface DependencyGraph {
	/** All nodes */
	nodes: Map<string, DepNode>
	/** All edges */
	edges: DepEdge[]
	/** Variable → defining node IDs */
	variableDefs: Map<string, string[]>
	/** Variable → using node IDs */
	variableUses: Map<string, string[]>
	/** Line → node IDs on that line */
	lineNodes: Map<number, string[]>
}

/** Slice criteria — what to slice on */
export interface SliceCriteria {
	/** Variable name */
	variableName: string
	/** Line number */
	lineNumber: number
	/** Direction */
	direction: 'backward' | 'forward'
}

/** Result of program slicing */
export interface SliceResult {
	/** The criteria used */
	criteria: SliceCriteria
	/** Lines included in the slice */
	slicedLines: number[]
	/** Total lines in original */
	totalLines: number
	/** Reduction percentage */
	reductionPercent: number
	/** Nodes in the slice */
	sliceNodes: DepNode[]
	/** Dependencies found */
	dependencies: DepEdge[]
	/** The sliced code */
	slicedCode: string
}

/** Slicing configuration */
export interface SlicerConfig {
	/** Include control dependencies (default: true) */
	includeControlDeps: boolean
	/** Include data dependencies (default: true) */
	includeDataDeps: boolean
	/** Maximum slice size (default: 1000 lines) */
	maxSliceSize: number
}

/** Default slicer config */
export const DEFAULT_SLICER_CONFIG: SlicerConfig = {
	includeControlDeps: true,
	includeDataDeps: true,
	maxSliceSize: 1000,
}
