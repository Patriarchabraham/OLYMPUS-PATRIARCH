import { readFile, stat } from 'fs/promises'
import { extname, basename } from 'path'
import type { DocumentParseResult, DocumentMetadata, SupportedFormat, PDFParserFn } from './types.js'

const FORMAT_MAP: Map<string, SupportedFormat> = new Map([
  ['.md', { extension: '.md', mimeType: 'text/markdown', category: 'document', parsingSupported: true }],
  ['.txt', { extension: '.txt', mimeType: 'text/plain', category: 'document', parsingSupported: true }],
  ['.json', { extension: '.json', mimeType: 'application/json', category: 'document', parsingSupported: true }],
  ['.jsonc', { extension: '.jsonc', mimeType: 'application/json', category: 'document', parsingSupported: true }],
  ['.csv', { extension: '.csv', mimeType: 'text/csv', category: 'document', parsingSupported: true }],
  ['.tsv', { extension: '.tsv', mimeType: 'text/tab-separated-values', category: 'document', parsingSupported: true }],
  ['.yaml', { extension: '.yaml', mimeType: 'application/yaml', category: 'document', parsingSupported: true }],
  ['.yml', { extension: '.yml', mimeType: 'application/yaml', category: 'document', parsingSupported: true }],
  ['.toml', { extension: '.toml', mimeType: 'application/toml', category: 'document', parsingSupported: true }],
  ['.xml', { extension: '.xml', mimeType: 'application/xml', category: 'document', parsingSupported: true }],
  ['.html', { extension: '.html', mimeType: 'text/html', category: 'document', parsingSupported: true }],
  ['.htm', { extension: '.htm', mimeType: 'text/html', category: 'document', parsingSupported: true }],
  ['.pdf', { extension: '.pdf', mimeType: 'application/pdf', category: 'document', parsingSupported: true }],
  ['.docx', { extension: '.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', category: 'document', parsingSupported: false }],
  ['.xlsx', { extension: '.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', category: 'document', parsingSupported: false }],
])

let pdfParser: PDFParserFn | null = null

export function setPDFParser(parser: PDFParserFn): void {
  pdfParser = parser
}

export function detectFormat(filePath: string): SupportedFormat {
  const ext = extname(filePath).toLowerCase()
  return FORMAT_MAP.get(ext) ?? {
    extension: ext,
    mimeType: 'application/octet-stream',
    category: 'document',
    parsingSupported: false,
  }
}

export async function parseDocument(filePath: string): Promise<DocumentParseResult> {
  const format = detectFormat(filePath)
  const ext = format.extension

  switch (ext) {
    case '.md':
    case '.txt':
    case '.markdown':
      return parseTextFile(filePath, ext.slice(1))
    case '.json':
    case '.jsonc':
      return parseJSON(filePath)
    case '.csv':
    case '.tsv':
      return parseCSV(filePath, ext === '.tsv' ? '\t' : ',')
    case '.yaml':
    case '.yml':
    case '.toml':
    case '.xml':
    case '.html':
    case '.htm':
      return parseTextFile(filePath, ext.slice(1))
    case '.pdf':
      return parsePDF(filePath)
    default:
      if (format.parsingSupported) {
        return parseTextFile(filePath, ext.slice(1))
      }
      throw new Error(`Unsupported document format: ${ext}`)
  }
}

async function buildMetadata(filePath: string, format: string): Promise<DocumentMetadata> {
  const fileStat = await stat(filePath)
  return {
    title: basename(filePath),
    createdAt: fileStat.birthtime?.toISOString(),
    modifiedAt: fileStat.mtime.toISOString(),
    format,
  }
}

export async function parseTextFile(filePath: string, format: string): Promise<DocumentParseResult> {
  const content = await readFile(filePath, 'utf-8')
  const metadata = await buildMetadata(filePath, format)
  metadata.wordCount = content.split(/\s+/).filter(Boolean).length
  metadata.pageCount = 1

  // Split on double newlines for "pages"
  const pages = content.split(/\n\n+/).filter(Boolean)

  return {
    filePath,
    text: content,
    pages,
    metadata,
  }
}

export async function parseJSON(filePath: string): Promise<DocumentParseResult> {
  const content = await readFile(filePath, 'utf-8')
  const metadata = await buildMetadata(filePath, 'json')

  let parsed: unknown
  try {
    // Strip JSONC comments (single-line only)
    const stripped = content.replace(/\/\/.*$/gm, '')
    parsed = JSON.parse(stripped)
  } catch {
    parsed = content
  }

  const formatted = typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2)
  metadata.wordCount = formatted.split(/\s+/).filter(Boolean).length
  metadata.pageCount = 1

  return {
    filePath,
    text: formatted,
    pages: [formatted],
    metadata,
  }
}

export async function parseCSV(filePath: string, separator: string = ','): Promise<DocumentParseResult> {
  const content = await readFile(filePath, 'utf-8')
  const metadata = await buildMetadata(filePath, 'csv')
  const lines = content.split('\n').filter(Boolean)
  metadata.pageCount = 1

  const rows: string[][] = []
  let currentRow: string[] = []

  for (const line of lines) {
    currentRow = parseCSVLine(line, separator)
    rows.push(currentRow)
  }

  metadata.wordCount = content.split(/\s+/).filter(Boolean).length

  return {
    filePath,
    text: content,
    pages: [content],
    metadata,
    tables: rows.length > 0 ? [rows] : undefined,
  }
}

function parseCSVLine(line: string, separator: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === separator && !inQuotes) {
      cells.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  cells.push(current.trim())
  return cells
}

export async function parsePDF(filePath: string): Promise<DocumentParseResult> {
  if (pdfParser) {
    const result = await pdfParser(filePath)
    const metadata = await buildMetadata(filePath, 'pdf')
    metadata.pageCount = result.pageCount
    metadata.wordCount = result.text.split(/\s+/).filter(Boolean).length

    return {
      filePath,
      text: result.text,
      pages: result.pages,
      metadata,
    }
  }

  // Fallback: try reading as binary and extract what we can
  throw new Error(
    'PDF parsing requires a PDF parser. Set one via setPDFParser(). ' +
    'Recommended: use pdf-parse or a similar library.'
  )
}
