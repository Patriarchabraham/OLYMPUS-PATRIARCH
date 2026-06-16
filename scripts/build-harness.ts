/**
 * Build the Olympuz instruction harness into a single compressed, self-contained,
 * versioned artifact.
 *
 * Walks src/harness/corpus/*.md, computes per-file sha256 + word count + layer,
 * writes a manifest, and zips everything (corpus + manifest + index) with fflate
 * (an existing dependency — no native addons) into:
 *   dist/harness/olympuz-harness-<version>.zip
 *   dist/harness/olympuz-harness-<version>.zip.sha256
 *
 * Run: `bun run scripts/build-harness.ts` (npm script: build:harness)
 */

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { zipSync } from 'fflate'

const here = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(here, '..')
const corpusDir = join(projectRoot, 'src', 'harness', 'corpus')
const outDir = join(projectRoot, 'dist', 'harness')

interface ManifestFile {
	path: string
	sha256: string
	words: number
	layer: string
}
interface Manifest {
	version: string
	generatedAt: string
	totalFiles: number
	totalWords: number
	files: ManifestFile[]
}

function sha256Hex(data: string | Uint8Array): string {
	return createHash('sha256').update(data).digest('hex')
}

function countWords(text: string): number {
	const trimmed = text.trim()
	if (trimmed.length === 0) return 0
	return trimmed.split(/\s+/).length
}

function layerOf(filename: string): string {
	const stem = filename.replace(/\.md$/, '')
	return stem.length >= 2 && /^\d{2}/.test(stem) ? stem.slice(0, 2) : 'misc'
}

function readVersion(): string {
	try {
		const pkg = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'))
		return typeof pkg.version === 'string' ? pkg.version : '0.0.0'
	} catch {
		return '0.0.0'
	}
}

function main(): void {
	if (!existsSync(corpusDir)) {
		console.error(`[build-harness] Corpus directory not found: ${corpusDir}`)
		process.exit(1)
	}

	const mdFiles = readdirSync(corpusDir)
		.filter((f) => f.endsWith('.md'))
		.sort()

	if (mdFiles.length === 0) {
		console.error(`[build-harness] No .md files in ${corpusDir}`)
		process.exit(1)
	}

	const version = readVersion()
	const manifestFiles: ManifestFile[] = []
	const zippable: Record<string, Uint8Array> = {}
	let totalWords = 0

	for (const filename of mdFiles) {
		const content = readFileSync(join(corpusDir, filename), 'utf8')
		const words = countWords(content)
		totalWords += words
		manifestFiles.push({
			path: filename,
			sha256: sha256Hex(content),
			words,
			layer: layerOf(filename),
		})
		// Store corpus files at the zip root by filename (matches loader expectations).
		zippable[filename] = new Uint8Array(Buffer.from(content, 'utf8'))
	}

	const manifest: Manifest = {
		version,
		generatedAt: new Date().toISOString(),
		totalFiles: mdFiles.length,
		totalWords,
		files: manifestFiles,
	}

	// index.json: layer -> [filenames]
	const index: Record<string, string[]> = {}
	for (const f of manifestFiles) {
		if (!index[f.layer]) index[f.layer] = []
		index[f.layer]!.push(f.path)
	}

	const manifestJson = JSON.stringify(manifest, null, 2)
	const indexJson = JSON.stringify(index, null, 2)
	zippable['manifest.json'] = new Uint8Array(Buffer.from(manifestJson, 'utf8'))
	zippable['index.json'] = new Uint8Array(Buffer.from(indexJson, 'utf8'))

	const zipBytes = zipSync(zippable)
	const zipSha = sha256Hex(zipBytes)

	if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })
	const zipName = `olympuz-harness-${version}.zip`
	const zipPath = join(outDir, zipName)
	writeFileSync(zipPath, zipBytes)
	writeFileSync(`${zipPath}.sha256`, `${zipSha}  ${zipName}\n`)
	// Also drop the manifest on disk for easy inspection.
	writeFileSync(join(outDir, `olympuz-harness-${version}.manifest.json`), manifestJson)

	const sizeKb = (zipBytes.byteLength / 1024).toFixed(1)
	console.log(
		`[build-harness] Wrote ${zipPath} (${sizeKb} KB, ${mdFiles.length} files, ${totalWords} words)`,
	)
	console.log(`[build-harness] sha256: ${zipSha}`)
}

main()
