/**
 * Harness types.
 *
 * The "harness" is the structured instruction corpus that drives Olympuz's
 * multi-agent behavior: operating doctrine, role addenda, zero-trust rules,
 * anti-error checklists, and quality bars. It is authored as small markdown
 * files under src/harness/corpus/ and distributed as a single compressed,
 * versioned artifact (see scripts/build-harness.ts).
 */

/** A single corpus file: its project-relative path and raw markdown content. */
export interface HarnessEntry {
	path: string
	content: string
}

/** Per-file metadata emitted into the bundle manifest. */
export interface HarnessManifestFile {
	path: string
	sha256: string
	words: number
	/** Layer prefix = first two chars of the filename stem (00, 01, 10, 20, 30). */
	layer: string
}

/** The manifest written next to the compressed bundle. */
export interface HarnessManifest {
	version: string
	generatedAt: string
	totalFiles: number
	totalWords: number
	files: HarnessManifestFile[]
}
