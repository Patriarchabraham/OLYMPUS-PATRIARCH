import { readFile, stat } from 'fs/promises'
import { extname, basename } from 'path'
import { gunzipSync, inflateSync } from 'zlib'
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
  ['.docx', { extension: '.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', category: 'document', parsingSupported: true }],
  ['.xlsx', { extension: '.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', category: 'document', parsingSupported: true }],
])

let pdfParser: PDFParserFn | null = null

/**
 * Register a PDF parser function.
 */
export function setPDFParser(parser: PDFParserFn): void {
  pdfParser = parser
}

/**
 * Detect the format of a file based on its extension.
 */
export function detectFormat(filePath: string): SupportedFormat {
  const ext = extname(filePath).toLowerCase()
  return FORMAT_MAP.get(ext) ?? {
    extension: ext,
    mimeType: 'application/octet-stream',
    category: 'document',
    parsingSupported: false,
  }
}

/**
 * Parse a document file based on its format.
 * Supports text, JSON, CSV, PDF, DOCX, XLSX, and more.
 */
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
    case '.docx':
      return parseDOCX(filePath)
    case '.xlsx':
      return parseXLSX(filePath)
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

/**
 * Parse a plain text or markdown file.
 */
export async function parseTextFile(filePath: string, format: string): Promise<DocumentParseResult> {
  const content = await readFile(filePath, 'utf-8')
  const metadata = await buildMetadata(filePath, format)
  metadata.wordCount = content.split(/\s+/).filter(Boolean).length
  metadata.pageCount = 1

  const pages = content.split(/\n\n+/).filter(Boolean)

  return {
    filePath,
    text: content,
    pages,
    metadata,
  }
}

/**
 * Parse a JSON or JSONC file.
 */
export async function parseJSON(filePath: string): Promise<DocumentParseResult> {
  const content = await readFile(filePath, 'utf-8')
  const metadata = await buildMetadata(filePath, 'json')

  let parsed: unknown
  try {
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

/**
 * Parse a CSV or TSV file with proper quoted-field handling.
 */
export async function parseCSV(filePath: string, separator: string = ','): Promise<DocumentParseResult> {
  const content = await readFile(filePath, 'utf-8')
  const metadata = await buildMetadata(filePath, 'csv')
  const lines = content.split('\n').filter(Boolean)
  metadata.pageCount = 1

  const rows: string[][] = []

  for (const line of lines) {
    const row = parseCSVLine(line, separator)
    rows.push(row)
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

/**
 * Parse a PDF file using the registered parser.
 */
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

  throw new Error(
    'PDF parsing requires a PDF parser. Set one via setPDFParser(). ' +
    'Recommended: use pdf-parse or a similar library.'
  )
}

// ============================================================
// ZIP / OOXML parsing utilities (for DOCX and XLSX)
// ============================================================

/**
 * Extract files from a ZIP archive (used for DOCX/XLSX which are ZIP-based).
 * Uses raw deflate decompression — no external dependencies.
 */
function extractZipEntries(buffer: Buffer): Map<string, Buffer> {
  const entries = new Map<string, Buffer>()

  // Find End of Central Directory (EOCD)
  let eocdOffset = -1
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i
      break
    }
  }
  if (eocdOffset === -1) throw new Error('Invalid ZIP: EOCD not found')

  const centralDirOffset = buffer.readUInt32LE(eocdOffset + 16)
  const centralDirEntries = buffer.readUInt16LE(eocdOffset + 10)

  let offset = centralDirOffset
  for (let i = 0; i < centralDirEntries; i++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break

    const compressionMethod = buffer.readUInt16LE(offset + 10)
    const compressedSize = buffer.readUInt32LE(offset + 20)
    const uncompressedSize = buffer.readUInt32LE(offset + 24)
    const nameLength = buffer.readUInt16LE(offset + 28)
    const extraLength = buffer.readUInt16LE(offset + 30)
    const commentLength = buffer.readUInt16LE(offset + 32)
    const localHeaderOffset = buffer.readUInt32LE(offset + 42)
    const name = buffer.toString('utf-8', offset + 46, offset + 46 + nameLength)

    offset += 46 + nameLength + extraLength + commentLength

    // Read local file header to get actual data offset
    if (buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) continue
    const localNameLen = buffer.readUInt16LE(localHeaderOffset + 26)
    const localExtraLen = buffer.readUInt16LE(localHeaderOffset + 28)
    const dataOffset = localHeaderOffset + 30 + localNameLen + localExtraLen
    const compressedData = buffer.subarray(dataOffset, dataOffset + compressedSize)

    let content: Buffer
    if (compressionMethod === 0) {
      // Stored (no compression)
      content = Buffer.from(compressedData)
    } else if (compressionMethod === 8) {
      // Deflate
      content = inflateSync(compressedData)
    } else {
      continue // Skip unknown compression methods
    }

    entries.set(name, content)
  }

  return entries
}

/**
 * Minimal XML text extraction: pulls text content from between XML tags.
 */
function extractXmlText(xml: string): string {
  // Remove processing instructions and comments
  let cleaned = xml.replace(/<\?[^?]*\?>/g, '')
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '')

  // Extract text between tags, preserving whitespace structure
  const parts: string[] = []
  const textRegex = />([^<]+)</g
  let match: RegExpExecArray | null
  while ((match = textRegex.exec(cleaned)) !== null) {
    const text = match[1]!.trim()
    if (text) parts.push(text)
  }

  return parts.join(' ')
}

/**
 * Extract all attributes of a given tag name from XML.
 */
function extractXmlAttributes(xml: string, tagName: string): Map<string, string> {
  const attrs = new Map<string, string>()
  const regex = new RegExp(`<${tagName}[^>]*>`, 'g')
  let match: RegExpExecArray | null
  while ((match = regex.exec(xml)) !== null) {
    const tag = match[0]
    // Extract all attribute pairs
    const attrRegex = /(\w+)="([^"]*)"/g
    let attrMatch: RegExpExecArray | null
    while ((attrMatch = attrRegex.exec(tag)) !== null) {
      attrs.set(attrMatch[1]!, attrMatch[2]!)
    }
  }
  return attrs
}

/**
 * Extract paragraph text from DOCX XML.
 * DOCX paragraphs are <w:p> elements containing <w:r><w:t> runs.
 */
function extractDocxParagraphs(xml: string): string[] {
  const paragraphs: string[] = []
  // Split on paragraph boundaries
  const pRegex = /<w:p[ >][\s\S]*?<\/w:p>/g
  let pMatch: RegExpExecArray | null
  while ((pMatch = pRegex.exec(xml)) !== null) {
    const pXml = pMatch[0]
    // Extract text runs
    const tRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g
    const runs: string[] = []
    let tMatch: RegExpExecArray | null
    while ((tMatch = tRegex.exec(pXml)) !== null) {
      runs.push(tMatch[1]!)
    }
    if (runs.length > 0) {
      paragraphs.push(runs.join(''))
    }
  }
  return paragraphs
}

/**
 * Extract table data from DOCX XML.
 * Tables are <w:tbl> with <w:tr> rows and <w:tc> cells.
 */
function extractDocxTables(xml: string): string[][][] {
  const tables: string[][][] = []
  const tblRegex = /<w:tbl[ >][\s\S]*?<\/w:tbl>/g
  let tblMatch: RegExpExecArray | null
  while ((tblMatch = tblRegex.exec(xml)) !== null) {
    const tblXml = tblMatch[0]
    const table: string[][] = []

    const trRegex = /<w:tr[ >][\s\S]*?<\/w:tr>/g
    let trMatch: RegExpExecArray | null
    while ((trMatch = trRegex.exec(tblXml)) !== null) {
      const row: string[] = []
      const trXml = trMatch[0]
      const tcRegex = /<w:tc[ >][\s\S]*?<\/w:tc>/g
      let tcMatch: RegExpExecArray | null
      while ((tcMatch = tcRegex.exec(trXml)) !== null) {
        // Extract text from cell
        const cellTexts: string[] = []
        const tRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g
        let tMatch: RegExpExecArray | null
        while ((tMatch = tRegex.exec(tcMatch[0])) !== null) {
          cellTexts.push(tMatch[1]!)
        }
        row.push(cellTexts.join(' '))
      }
      if (row.length > 0) table.push(row)
    }
    if (table.length > 0) tables.push(table)
  }
  return tables
}

/**
 * Convert an Excel column letter (A, B, ..., Z, AA, ...) to a 0-based index.
 */
function columnLetterToIndex(letters: string): number {
  let index = 0
  for (let i = 0; i < letters.length; i++) {
    index = index * 26 + (letters.charCodeAt(i) - 64)
  }
  return index - 1
}

/**
 * Parse XLSX shared strings XML into an array of strings.
 */
function parseXlsxSharedStrings(xml: string): string[] {
  const strings: string[] = []
  const siRegex = /<si[\s>][\s\S]*?<\/si>/g
  let match: RegExpExecArray | null
  while ((match = siRegex.exec(xml)) !== null) {
    const siXml = match[0]
    const tRegex = /<t[^>]*>([^<]*)<\/t>/g
    const parts: string[] = []
    let tMatch: RegExpExecArray | null
    while ((tMatch = tRegex.exec(siXml)) !== null) {
      parts.push(tMatch[1]!)
    }
    strings.push(parts.join(''))
  }
  return strings
}

/**
 * Parse XLSX worksheet XML into a 2D array of cell values.
 */
function parseXlsxWorksheet(xml: string, sharedStrings: string[]): string[][] {
  const rows = new Map<number, Map<number, string>>()
  let maxRow = 0
  let maxCol = 0

  const cellRegex = /<c\s+r="([A-Z]+)(\d+)"([^>]*)>/g
  let cellMatch: RegExpExecArray | null
  while ((cellMatch = cellRegex.exec(xml)) !== null) {
    const colLetters = cellMatch[1]!
    const rowNum = parseInt(cellMatch[2]!, 10) - 1 // 0-based
    const attrs = cellMatch[3]!
    const colNum = columnLetterToIndex(colLetters)

    // Find the cell value — look ahead for <v> tag
    const afterCell = xml.indexOf(cellMatch[0]) + cellMatch[0].length
    const nextCell = xml.indexOf('<c ', afterCell)
    const cellContent = xml.substring(afterCell, nextCell === -1 ? xml.length : nextCell)
    const vMatch = cellContent.match(/<v>([^<]*)<\/v>/)

    if (vMatch) {
      const rawValue = vMatch[1]!
      let value: string

      if (attrs.includes('t="s"')) {
        // Shared string reference
        const idx = parseInt(rawValue, 10)
        value = idx < sharedStrings.length ? sharedStrings[idx]! : rawValue
      } else if (attrs.includes('t="b"')) {
        value = rawValue === '1' ? 'TRUE' : 'FALSE'
      } else {
        value = rawValue
      }

      if (!rows.has(rowNum)) rows.set(rowNum, new Map())
      rows.get(rowNum)!.set(colNum, value)

      maxRow = Math.max(maxRow, rowNum)
      maxCol = Math.max(maxCol, colNum)
    }
  }

  // Convert to 2D array
  const result: string[][] = []
  for (let r = 0; r <= maxRow; r++) {
    const row: string[] = []
    const rowMap = rows.get(r)
    for (let c = 0; c <= maxCol; c++) {
      row.push(rowMap?.get(c) ?? '')
    }
    result.push(row)
  }

  return result
}

// ============================================================
// DOCX Parser
// ============================================================

/**
 * Parse a DOCX file (Office Open XML).
 * Extracts text content, paragraphs, and tables from the ZIP-based format.
 */
export async function parseDOCX(filePath: string): Promise<DocumentParseResult> {
  const rawBuffer = await readFile(filePath)
  const entries = extractZipEntries(rawBuffer)

  // Extract main document content
  const documentXml = entries.get('word/document.xml')
  if (!documentXml) {
    throw new Error('Invalid DOCX: word/document.xml not found')
  }
  const xmlStr = documentXml.toString('utf-8')

  // Extract paragraphs
  const paragraphs = extractDocxParagraphs(xmlStr)
  const text = paragraphs.join('\n\n')

  // Extract tables
  const tables = extractDocxTables(xmlStr)

  // Try to extract core properties
  const coreXml = entries.get('docProps/core.xml')
  const metadata = await buildMetadata(filePath, 'docx')
  metadata.wordCount = text.split(/\s+/).filter(Boolean).length

  if (coreXml) {
    const coreStr = coreXml.toString('utf-8')
    const titleMatch = coreStr.match(/<dc:title[^>]*>([^<]*)<\/dc:title>/)
    const authorMatch = coreStr.match(/<dc:creator[^>]*>([^<]*)<\/dc:creator>/)
    if (titleMatch?.[1]) metadata.title = titleMatch[1]
    if (authorMatch?.[1]) metadata.author = authorMatch[1]
  }

  // Estimate page count (~500 words per page)
  metadata.pageCount = Math.max(1, Math.ceil((metadata.wordCount ?? 0) / 500))

  return {
    filePath,
    text,
    pages: paragraphs,
    metadata,
    tables: tables.length > 0 ? tables : undefined,
  }
}

// ============================================================
// XLSX Parser
// ============================================================

/**
 * Parse an XLSX file (Office Open XML Spreadsheet).
 * Extracts cell data from the first worksheet using shared strings.
 */
export async function parseXLSX(filePath: string): Promise<DocumentParseResult> {
  const rawBuffer = await readFile(filePath)
  const entries = extractZipEntries(rawBuffer)

  // Extract shared strings
  const sharedStringsXml = entries.get('xl/sharedStrings.xml')
  const sharedStrings: string[] = sharedStringsXml
    ? parseXlsxSharedStrings(sharedStringsXml.toString('utf-8'))
    : []

  // Find and parse the first worksheet
  let worksheetXml: Buffer | undefined
  // Try sheet1.xml first, then search for any worksheet
  worksheetXml = entries.get('xl/worksheets/sheet1.xml')
  if (!worksheetXml) {
    // Search for any sheet
    const entryArray = Array.from(entries.entries())
    for (const [name, data] of entryArray) {
      if (name.match(/^xl\/worksheets\/sheet\d+\.xml$/)) {
        worksheetXml = data
        break
      }
    }
  }

  if (!worksheetXml) {
    throw new Error('Invalid XLSX: no worksheet found')
  }

  const rows = parseXlsxWorksheet(worksheetXml.toString('utf-8'), sharedStrings)

  // Build text representation
  const textLines = rows.map(row => row.join('\t'))
  const text = textLines.join('\n')

  // Try to extract core properties
  const coreXml = entries.get('docProps/core.xml')
  const metadata = await buildMetadata(filePath, 'xlsx')
  metadata.wordCount = text.split(/\s+/).filter(Boolean).length

  if (coreXml) {
    const coreStr = coreXml.toString('utf-8')
    const titleMatch = coreStr.match(/<dc:title[^>]*>([^<]*)<\/dc:title>/)
    const authorMatch = coreStr.match(/<dc:creator[^>]*>([^<]*)<\/dc:creator>/)
    if (titleMatch?.[1]) metadata.title = titleMatch[1]
    if (authorMatch?.[1]) metadata.author = authorMatch[1]
  }

  metadata.pageCount = 1

  return {
    filePath,
    text,
    pages: [text],
    metadata,
    tables: rows.length > 0 ? [rows] : undefined,
  }
}
