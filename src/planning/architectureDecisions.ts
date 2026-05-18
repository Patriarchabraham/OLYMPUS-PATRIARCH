import { randomUUID } from 'crypto'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import type { ArchitectureDecision, ArchitectureDecisionAlternative } from './types.js'

const decisions = new Map<string, ArchitectureDecision>()
let dataDir: string | null = null

export function setDataDir(dir: string): void {
  dataDir = dir
}

export function createADR(
  title: string,
  context: string,
  decision: string,
): ArchitectureDecision {
  const adr: ArchitectureDecision = {
    id: randomUUID(),
    title,
    context,
    decision,
    consequences: [],
    alternatives: [],
    status: 'proposed',
    date: Date.now(),
  }
  decisions.set(adr.id, adr)
  return adr
}

export function addAlternative(
  adrId: string,
  name: string,
  description: string,
  rejected = true,
  reason = '',
): void {
  const adr = decisions.get(adrId)
  if (!adr) throw new Error(`ADR not found: ${adrId}`)

  const alt: ArchitectureDecisionAlternative = {
    name,
    description,
    rejected,
    reason,
  }
  adr.alternatives.push(alt)
}

export function addConsequence(adrId: string, consequence: string): void {
  const adr = decisions.get(adrId)
  if (!adr) throw new Error(`ADR not found: ${adrId}`)
  adr.consequences.push(consequence)
}

export function acceptDecision(adrId: string): void {
  const adr = decisions.get(adrId)
  if (!adr) throw new Error(`ADR not found: ${adrId}`)
  adr.status = 'accepted'
}

export function deprecateDecision(adrId: string, supersededBy: string): void {
  const adr = decisions.get(adrId)
  if (!adr) throw new Error(`ADR not found: ${adrId}`)
  adr.status = 'superseded'
  adr.consequences.push(`Superseded by decision ${supersededBy}`)
}

export function getDecision(adrId: string): ArchitectureDecision | undefined {
  return decisions.get(adrId)
}

export function listDecisions(
  filter?: Partial<Pick<ArchitectureDecision, 'status' | 'title'>>,
): ArchitectureDecision[] {
  const all = Array.from(decisions.values())
  if (!filter) return all

  return all.filter(d => {
    if (filter.status && d.status !== filter.status) return false
    if (filter.title && !d.title.toLowerCase().includes(filter.title.toLowerCase())) return false
    return true
  })
}

export function exportADRs(): string {
  const all = Array.from(decisions.values()).sort((a, b) => b.date - a.date)

  if (all.length === 0) return '# Architecture Decision Records\n\nNo decisions recorded.\n'

  let md = '# Architecture Decision Records\n\n'

  for (const adr of all) {
    md += `## ${adr.title}\n\n`
    md += `- **ID:** ${adr.id}\n`
    md += `- **Status:** ${adr.status}\n`
    md += `- **Date:** ${new Date(adr.date).toISOString()}\n`
    if (adr.author) md += `- **Author:** ${adr.author}\n`
    md += `\n### Context\n\n${adr.context}\n\n`
    md += `### Decision\n\n${adr.decision}\n\n`

    if (adr.consequences.length > 0) {
      md += `### Consequences\n\n`
      for (const c of adr.consequences) {
        md += `- ${c}\n`
      }
      md += '\n'
    }

    if (adr.alternatives.length > 0) {
      md += `### Alternatives Considered\n\n`
      for (const alt of adr.alternatives) {
        const status = alt.rejected ? 'rejected' : 'considered'
        md += `- **${alt.name}** (${status}): ${alt.description}\n`
        if (alt.reason) md += `  - Reason: ${alt.reason}\n`
      }
      md += '\n'
    }

    md += '---\n\n'
  }

  return md
}

export function importADRs(markdown: string): ArchitectureDecision[] {
  const imported: ArchitectureDecision[] = []
  const sections = markdown.split(/^## /m).filter(s => s.trim() && !s.startsWith('#'))

  for (const section of sections) {
    const lines = section.split('\n')
    const title = lines[0]!.trim()

    // Extract fields using simple parsing
    const getField = (label: string): string => {
      const line = lines.find(l => l.includes(`**${label}:**`))
      return line ? line.split(`**${label}:**`)[1]!.trim() : ''
    }

    const id = getField('ID') || randomUUID()
    const status = getField('Status') as ArchitectureDecision['status'] || 'proposed'
    const dateStr = getField('Date')
    const date = dateStr ? new Date(dateStr).getTime() : Date.now()

    // Extract context, decision sections
    const getSection = (heading: string): string => {
      const startIdx = lines.findIndex(l => l.trim() === `### ${heading}`)
      if (startIdx === -1) return ''
      const contentLines: string[] = []
      for (let i = startIdx + 1; i < lines.length; i++) {
        if (lines[i]!.startsWith('### ') || lines[i]!.startsWith('---')) break
        contentLines.push(lines[i]!)
      }
      return contentLines.join('\n').trim()
    }

    const adr: ArchitectureDecision = {
      id,
      title,
      context: getSection('Context'),
      decision: getSection('Decision'),
      consequences: [],
      alternatives: [],
      status,
      date,
    }

    decisions.set(adr.id, adr)
    imported.push(adr)
  }

  return imported
}

export async function persistADRs(): Promise<void> {
  if (!dataDir) return
  const dir = join(dataDir, 'decisions')
  await mkdir(dir, { recursive: true })

  const all = Array.from(decisions.values())
  await writeFile(
    join(dir, 'adrs.json'),
    JSON.stringify(all, null, 2),
    'utf-8',
  )
}

export async function loadADRs(): Promise<void> {
  if (!dataDir) return
  try {
    const content = await readFile(join(dataDir, 'decisions', 'adrs.json'), 'utf-8')
    const loaded = JSON.parse(content) as ArchitectureDecision[]
    for (const adr of loaded) {
      decisions.set(adr.id, adr)
    }
  } catch {
    // File doesn't exist yet — that's fine
  }
}

export function clearDecisions(): void {
  decisions.clear()
}
