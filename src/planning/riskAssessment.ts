import { randomUUID } from 'crypto'
import type { Risk, ImpactAssessment } from './types.js'

const riskMatrix: Record<string, Record<string, number>> = {
  low: { low: 1, medium: 2, high: 3 },
  medium: { low: 2, medium: 4, high: 6 },
  high: { low: 3, medium: 6, high: 9 },
}

export function calculateRiskScore(
  probability: string,
  impact: string,
): number {
  return riskMatrix[probability]?.[impact] ?? 1
}

export function assessRisk(
  change: string,
  files: string[],
): Risk {
  const fileCount = files.length

  // Heuristic risk assessment based on change description and scope
  let probability: Risk['probability'] = 'low'
  let impact: Risk['impact'] = 'low'

  // High-risk indicators
  const highRiskKeywords = [
    'database', 'migration', 'schema', 'auth', 'security',
    'payment', 'production', 'deploy', 'release',
  ]
  const mediumRiskKeywords = [
    'refactor', 'rename', 'api', 'endpoint', 'config',
    'dependency', 'upgrade', 'performance',
  ]

  const changeLower = change.toLowerCase()
  const hasHighRisk = highRiskKeywords.some(k => changeLower.includes(k))
  const hasMediumRisk = mediumRiskKeywords.some(k => changeLower.includes(k))

  if (hasHighRisk) {
    probability = 'medium'
    impact = 'high'
  } else if (hasMediumRisk) {
    probability = 'medium'
    impact = 'medium'
  }

  // Scale by file count
  if (fileCount > 20) {
    probability = 'high'
    impact = impact === 'low' ? 'medium' : impact === 'medium' ? 'high' : 'high'
  } else if (fileCount > 10) {
    if (probability === 'low') probability = 'medium'
  } else if (fileCount > 5) {
    if (impact === 'low') impact = 'medium'
  }

  const score = calculateRiskScore(probability, impact)
  const mitigations = generateMitigationPlan({
    id: '',
    title: change,
    description: '',
    probability,
    impact,
    mitigation: '',
    status: 'identified',
  })

  return {
    id: randomUUID(),
    title: `Risk: ${change.slice(0, 60)}`,
    description: `Assessed risk for change involving ${fileCount} file(s)`,
    probability,
    impact,
    mitigation: mitigations[0] ?? 'Review changes carefully before applying',
    status: 'identified',
  }
}

export async function assessImpact(
  change: string,
  codebasePath: string,
): Promise<ImpactAssessment> {
  const { readdir, stat } = await import('fs/promises')
  const { join, extname } = await import('path')

  // Walk directory to find affected files
  const affectedFiles: string[] = []
  const affectedModules = new Set<string>()

  async function walk(dir: string, depth = 0): Promise<void> {
    if (depth > 5) return
    try {
      const entries = await readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') continue
        const fullPath = join(dir, entry.name)
        if (entry.isDirectory()) {
          await walk(fullPath, depth + 1)
        } else {
          const ext = extname(entry.name)
          if (['.ts', '.tsx', '.js', '.jsx', '.py'].includes(ext)) {
            affectedFiles.push(fullPath)
            // Module = directory name
            const parts = fullPath.replace(/\\/g, '/').split('/')
            if (parts.length > 1) {
              affectedModules.add(parts[parts.length - 2]!)
            }
          }
        }
      }
    } catch {
      // Permission denied or similar
    }
  }

  await walk(codebasePath)

  // Determine risk level based on scope
  const fileCount = affectedFiles.length
  let riskLevel: ImpactAssessment['riskLevel'] = 'low'
  if (fileCount > 50) riskLevel = 'critical'
  else if (fileCount > 20) riskLevel = 'high'
  else if (fileCount > 10) riskLevel = 'medium'

  const changeLower = change.toLowerCase()
  const isBreaking = /breaking|remove|delete|rename|deprecate/i.test(change)
  if (isBreaking && riskLevel === 'low') riskLevel = 'medium'

  const breakingChanges: string[] = []
  if (isBreaking) {
    breakingChanges.push(`Change "${change}" may introduce breaking API changes`)
  }

  // Estimate effort: rough heuristic
  const estimatedEffort = Math.max(1, Math.ceil(fileCount / 5))

  return {
    change,
    affectedFiles,
    affectedModules: Array.from(affectedModules),
    riskLevel,
    breakingChanges,
    requiredTests: affectedFiles.filter(f =>
      f.includes('.test.') || f.includes('.spec.'),
    ),
    estimatedEffort,
    dependencies: [],
  }
}

export function prioritizeRisks(risks: Risk[]): Risk[] {
  return [...risks].sort((a, b) => {
    const scoreA = calculateRiskScore(a.probability, a.impact)
    const scoreB = calculateRiskScore(b.probability, b.impact)
    return scoreB - scoreA
  })
}

export function generateMitigationPlan(risk: Risk): string[] {
  const mitigations: string[] = []
  const score = calculateRiskScore(risk.probability, risk.impact)

  if (score >= 6) {
    mitigations.push('Create a detailed test plan before implementing changes')
    mitigations.push('Implement changes behind a feature flag for gradual rollout')
    mitigations.push('Set up monitoring and alerting for affected areas')
    mitigations.push('Prepare a rollback plan')
  }

  if (score >= 4) {
    mitigations.push('Review changes with at least one other team member')
    mitigations.push('Write integration tests covering the change')
  }

  if (risk.impact === 'high') {
    mitigations.push('Stage changes in a non-production environment first')
  }

  if (risk.probability === 'high') {
    mitigations.push('Break the change into smaller, incremental steps')
  }

  // Always include
  mitigations.push('Document the change and its rationale')

  return mitigations
}
