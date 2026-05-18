import { randomUUID } from 'crypto'
import {
  type ProjectPlan,
  type PlanObjective,
  type PlanMilestone,
  type Dependency,
  type TimelinePhase,
} from './types.js'

// In-memory plan store
const plans = new Map<string, ProjectPlan>()

export function createPlan(title: string, description: string): ProjectPlan {
  const now = Date.now()
  const plan: ProjectPlan = {
    id: randomUUID(),
    title,
    description,
    objectives: [],
    milestones: [],
    risks: [],
    decisions: [],
    dependencies: [],
    timeline: {
      startDate: now,
      phases: [],
    },
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  }
  plans.set(plan.id, plan)
  return plan
}

export function getPlan(planId: string): ProjectPlan | undefined {
  return plans.get(planId)
}

export function listPlans(filter?: { status?: ProjectPlan['status'] }): ProjectPlan[] {
  const all = Array.from(plans.values())
  if (!filter) return all
  return all.filter(p => {
    if (filter.status && p.status !== filter.status) return false
    return true
  })
}

export function addObjective(planId: string, objective: PlanObjective): void {
  const plan = plans.get(planId)
  if (!plan) throw new Error(`Plan not found: ${planId}`)
  plan.objectives.push(objective)
  plan.updatedAt = Date.now()
}

export function addMilestone(planId: string, milestone: PlanMilestone): void {
  const plan = plans.get(planId)
  if (!plan) throw new Error(`Plan not found: ${planId}`)
  plan.milestones.push(milestone)
  plan.updatedAt = Date.now()
}

export function addDependency(planId: string, dependency: Dependency): void {
  const plan = plans.get(planId)
  if (!plan) throw new Error(`Plan not found: ${planId}`)
  plan.dependencies.push(dependency)
  plan.updatedAt = Date.now()
}

export function addPhase(planId: string, phase: TimelinePhase): void {
  const plan = plans.get(planId)
  if (!plan) throw new Error(`Plan not found: ${planId}`)
  plan.timeline.phases.push(phase)
  plan.updatedAt = Date.now()
}

export function updatePlanStatus(planId: string, status: ProjectPlan['status']): void {
  const plan = plans.get(planId)
  if (!plan) throw new Error(`Plan not found: ${planId}`)
  plan.status = status
  plan.updatedAt = Date.now()
  if (status === 'completed') {
    plan.timeline.endDate = Date.now()
  }
}

export function generatePlanFromDescription(description: string): ProjectPlan {
  const plan = createPlan('Auto-generated Plan', description)

  // Parse description into objectives using simple heuristics
  const lines = description.split('\n').filter(l => l.trim())
  const objectiveLines = lines.filter(l =>
    /^[-*•]\s/.test(l.trim()) ||
    /^\d+[.)]\s/.test(l.trim()) ||
    /^(TODO|TASK|GOAL|OBJECTIVE):/i.test(l.trim()),
  )

  for (let i = 0; i < objectiveLines.length; i++) {
    const text = objectiveLines[i]!.replace(/^[-*•]\s/, '').replace(/^\d+[.)]\s/, '').replace(/^(TODO|TASK|GOAL|OBJECTIVE):\s*/i, '')
    plan.objectives.push({
      id: randomUUID(),
      title: text.slice(0, 80),
      description: text,
      priority: i === 0 ? 'critical' : i < 3 ? 'high' : 'medium',
      status: 'pending',
      estimatedEffort: 2,
    })
  }

  // If no structured objectives found, create a single one from the description
  if (plan.objectives.length === 0) {
    plan.objectives.push({
      id: randomUUID(),
      title: 'Complete project',
      description,
      priority: 'high',
      status: 'pending',
      estimatedEffort: 8,
    })
  }

  // Create milestones from priority groups
  const criticalObjs = plan.objectives.filter(o => o.priority === 'critical' || o.priority === 'high')
  const otherObjs = plan.objectives.filter(o => o.priority !== 'critical' && o.priority !== 'high')

  if (criticalObjs.length > 0) {
    plan.milestones.push({
      id: randomUUID(),
      title: 'Phase 1 — Core',
      description: 'Complete critical and high-priority objectives',
      objectives: criticalObjs.map(o => o.id),
      status: 'pending',
    })
  }

  if (otherObjs.length > 0) {
    plan.milestones.push({
      id: randomUUID(),
      title: 'Phase 2 — Enhancement',
      description: 'Complete medium and low-priority objectives',
      objectives: otherObjs.map(o => o.id),
      status: 'pending',
    })
  }

  plan.status = 'active'
  return plan
}

export function assessProgress(planId: string): {
  percentComplete: number
  atRisk: PlanMilestone[]
  blockers: string[]
} {
  const plan = plans.get(planId)
  if (!plan) throw new Error(`Plan not found: ${planId}`)

  const total = plan.objectives.length
  const completed = plan.objectives.filter(o => o.status === 'completed').length
  const percentComplete = total > 0 ? Math.round((completed / total) * 100) : 0

  const atRisk = plan.milestones.filter(m => {
    if (m.status !== 'in_progress' && m.status !== 'at_risk') return false
    const milestoneObjs = plan.objectives.filter(o => m.objectives.includes(o.id))
    const completedInMilestone = milestoneObjs.filter(o => o.status === 'completed').length
    // At risk if less than 50% complete and target date is approaching or past
    if (m.targetDate && Date.now() > m.targetDate * 0.8) {
      return completedInMilestone / milestoneObjs.length < 0.5
    }
    return false
  })

  // Find blockers: objectives that are pending but have unmet dependencies
  const completedIds = new Set(plan.objectives.filter(o => o.status === 'completed').map(o => o.id))
  const blockers: string[] = []
  for (const dep of plan.dependencies) {
    if (dep.type === 'blocks' && !completedIds.has(dep.to)) {
      const blockedObj = plan.objectives.find(o => o.id === dep.from)
      if (blockedObj && blockedObj.status === 'pending') {
        blockers.push(`${blockedObj.title} (blocked by ${dep.to})`)
      }
    }
  }

  return { percentComplete, atRisk, blockers }
}

export function suggestNextSteps(planId: string): PlanObjective[] {
  const plan = plans.get(planId)
  if (!plan) throw new Error(`Plan not found: ${planId}`)

  const completedIds = new Set(plan.objectives.filter(o => o.status === 'completed').map(o => o.id))
  const inProgressIds = new Set(plan.objectives.filter(o => o.status === 'in_progress').map(o => o.id))

  // Find objectives that are pending and have all dependencies met
  const ready: PlanObjective[] = []
  for (const obj of plan.objectives) {
    if (obj.status !== 'pending') continue

    const deps = plan.dependencies.filter(d => d.from === obj.id && d.type === 'requires')
    const allDepsMet = deps.every(d => completedIds.has(d.to))

    if (allDepsMet) {
      ready.push(obj)
    }
  }

  // Sort by priority
  const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
  ready.sort((a, b) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2))

  // If nothing ready, suggest in-progress ones
  if (ready.length === 0) {
    return plan.objectives.filter(o => o.status === 'in_progress')
  }

  return ready
}

export function exportPlan(planId: string, format: 'markdown' | 'json'): string {
  const plan = plans.get(planId)
  if (!plan) throw new Error(`Plan not found: ${planId}`)

  if (format === 'json') {
    return JSON.stringify(plan, null, 2)
  }

  // Markdown format
  let md = `# ${plan.title}\n\n`
  md += `${plan.description}\n\n`
  md += `**Status:** ${plan.status} | **Created:** ${new Date(plan.createdAt).toISOString()}\n\n`

  md += `## Objectives\n\n`
  for (const obj of plan.objectives) {
    const check = obj.status === 'completed' ? 'x' : ' '
    md += `- [${check}] **${obj.title}** (${obj.priority}) — ${obj.status}\n`
    if (obj.description !== obj.title) {
      md += `  > ${obj.description}\n`
    }
  }

  md += `\n## Milestones\n\n`
  for (const ms of plan.milestones) {
    md += `### ${ms.title} [${ms.status}]\n`
    md += `${ms.description}\n\n`
  }

  if (plan.risks.length > 0) {
    md += `## Risks\n\n`
    for (const risk of plan.risks) {
      md += `- **${risk.title}** (P:${risk.probability} / I:${risk.impact}) — ${risk.status}\n`
      md += `  Mitigation: ${risk.mitigation}\n`
    }
  }

  if (plan.dependencies.length > 0) {
    md += `\n## Dependencies\n\n`
    for (const dep of plan.dependencies) {
      md += `- ${dep.from} → ${dep.to} (${dep.type}, ${dep.strength})\n`
    }
  }

  return md
}

export function importPlan(data: string, format: 'markdown' | 'json'): ProjectPlan {
  if (format === 'json') {
    const plan = JSON.parse(data) as ProjectPlan
    plans.set(plan.id, plan)
    return plan
  }

  // Parse markdown — extract title and objectives
  const lines = data.split('\n')
  let title = 'Imported Plan'
  let description = ''
  const objectives: PlanObjective[] = []

  for (const line of lines) {
    const headingMatch = line.match(/^#\s+(.+)$/)
    if (headingMatch && title === 'Imported Plan') {
      title = headingMatch[1]!
      continue
    }

    const objMatch = line.match(/^- \[([ x])\] \*\*(.+?)\*\* \((\w+)\) — (\w+)/)
    if (objMatch) {
      objectives.push({
        id: randomUUID(),
        title: objMatch[2]!,
        description: objMatch[2]!,
        priority: objMatch[3]!.toLowerCase() as PlanObjective['priority'],
        status: objMatch[1] === 'x' ? 'completed' : 'pending',
        estimatedEffort: 2,
      })
    }

    if (!line.startsWith('#') && !line.startsWith('-') && description.length < 200) {
      description += (description ? ' ' : '') + line.trim()
    }
  }

  const plan = createPlan(title, description.trim())
  for (const obj of objectives) {
    plan.objectives.push(obj)
  }
  plan.status = 'active'
  return plan
}

export function clearPlans(): void {
  plans.clear()
}
