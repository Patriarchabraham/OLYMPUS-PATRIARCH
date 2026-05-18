import { readFile, readdir, stat } from 'fs/promises'
import { extname, join, relative, basename } from 'path'
import { createHash } from 'crypto'
import type { Document, DocumentChunk } from './types.js'

const SUPPORTED_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.rb', '.go', '.rs', '.java', '.kt', '.swift', '.c', '.cpp', '.h',
  '.md', '.mdx', '.txt', '.rst', '.adoc',
  '.json', '.yaml', '.yml', '.toml', '.xml', '.ini', '.env',
  '.css', '.scss', '.less', '.html', '.htm', '.vue', '.svelte',
  '.sh', '.bash', '.zsh', '.fish',
  '.sql', '.graphql', '.proto',
  '.dockerfile',
])

const DEFAULT_EXCLUDE = new Set([
  'node_modules', '.git', '.svn', '.hg', 'dist', 'build', 'out',
  '.next', '.nuxt', 'coverage', '.coverage', '__pycache__',
  '.tox', '.mypy_cache', '.pytest_cache', 'vendor', 'target',
  '.gradle', '.idea', '.vscode', '.openclaude',
])

const EXTENSION_LANGUAGE: Record<string, string> = {
  '.ts': 'typescript', '.tsx': 'typescript', '.js': 'javascript', '.jsx': 'javascript',
  '.mjs': 'javascript', '.cjs': 'javascript',
  '.py': 'python', '.rb': 'ruby', '.go': 'go', '.rs': 'rust',
  '.java': 'java', '.kt': 'kotlin', '.swift': 'swift',
  '.c': 'c', '.cpp': 'cpp', '.h': 'c',
  '.md': 'markdown', '.mdx': 'markdown', '.txt': 'text', '.rst': 'rst',
  '.json': 'json', '.yaml': 'yaml', '.yml': 'yaml', '.toml': 'toml',
  '.css': 'css', '.scss': 'scss', '.html': 'html', '.htm': 'html',
  '.sh': 'shell', '.bash': 'shell', '.sql': 'sql', '.graphql': 'graphql',
}

export function detectLanguage(filePath: string): string {
  const ext = extname(filePath).toLowerCase()
  if (basename(filePath) === 'Dockerfile') return 'dockerfile'
  return EXTENSION_LANGUAGE[ext] ?? 'unknown'
}

export function getFileType(filePath: string): Document['type'] {
  const ext = extname(filePath).toLowerCase()
  if (['.ts', '.tsx', '.js', '.jsx', '.py', '.rb', '.go', '.rs', '.java', '.c', '.cpp', '.h'].includes(ext)) {
    return 'code'
  }
  if (['.md', '.mdx', '.txt', '.rst'].includes(ext)) return 'markdown'
  if (['.json', '.yaml', '.yml', '.toml', '.xml', '.ini'].includes(ext)) return 'json'
  if (['.css', '.scss', '.html', '.htm'].includes(ext)) return 'config'
  return 'other'
}

function computeChecksum(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16)
}

export async function extractContent(filePath: string): Promise<string> {
  try {
    const content = await readFile(filePath, 'utf-8')
    return content
  } catch {
    return ''
  }
}

export function chunkDocument(document: Document, chunkSize: number = 500, overlap: number = 50): DocumentChunk[] {
  const lines = document.content.split('\n')
  const chunks: DocumentChunk[] = []

  let currentChunk: string[] = []
  let currentSize = 0
  let startLine = 0
  let chunkIndex = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const lineSize = line.length + 1

    if (currentSize + lineSize > chunkSize && currentChunk.length > 0) {
      const content = currentChunk.join('\n')
      chunks.push({
        id: `${document.id}_chunk_${chunkIndex}`,
        documentId: document.id,
        content,
        index: chunkIndex,
        startLine,
        endLine: i - 1,
      })
      chunkIndex++

      // Overlap: keep last N lines
      const overlapLines: string[] = []
      let overlapSize = 0
      for (let j = currentChunk.length - 1; j >= 0; j--) {
        overlapLines.unshift(currentChunk[j]!)
        overlapSize += currentChunk[j]!.length + 1
        if (overlapSize >= overlap) break
      }
      currentChunk = [...overlapLines]
      currentSize = overlapSize
      startLine = i - overlapLines.length
    }

    currentChunk.push(line)
    currentSize += lineSize
  }

  // Remaining chunk
  if (currentChunk.length > 0) {
    chunks.push({
      id: `${document.id}_chunk_${chunkIndex}`,
      documentId: document.id,
      content: currentChunk.join('\n'),
      index: chunkIndex,
      startLine,
      endLine: lines.length - 1,
    })
  }

  return chunks
}

export async function ingestFile(filePath: string, basePath?: string): Promise<Document> {
  const content = await extractContent(filePath)
  const filePathResolved = basePath ? relative(basePath, filePath) : filePath
  const stats = await stat(filePath).catch(() => ({ mtimeMs: Date.now() }))

  const document: Document = {
    id: createHash('sha256').update(filePathResolved).digest('hex').slice(0, 16),
    path: filePathResolved,
    content,
    type: getFileType(filePath),
    language: detectLanguage(filePath),
    lastModified: stats.mtimeMs,
    checksum: computeChecksum(content),
    chunks: [],
  }

  document.chunks = chunkDocument(document)
  return document
}

export async function ingestDirectory(
  dirPath: string,
  options?: { extensions?: string[]; exclude?: string[] },
): Promise<Document[]> {
  const extensions = options?.extensions
    ? new Set(options.extensions)
    : SUPPORTED_EXTENSIONS
  const exclude = new Set([...DEFAULT_EXCLUDE, ...(options?.exclude ?? [])])

  const documents: Document[] = []
  const queue: string[] = [dirPath]

  while (queue.length > 0) {
    const currentDir = queue.shift()!
    let entries
    try {
      entries = await readdir(currentDir, { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name)

      if (exclude.has(entry.name)) continue

      if (entry.isDirectory()) {
        queue.push(fullPath)
      } else if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase()
        if (extensions.has(ext) || (entry.name === 'Dockerfile' && extensions.has('.dockerfile'))) {
          const doc = await ingestFile(fullPath, dirPath)
          if (doc.content.length > 0) {
            documents.push(doc)
          }
        }
      }
    }
  }

  return documents
}
