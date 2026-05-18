import type { InteractionRecord, ToolUsageStats, ToolRecommendation } from './types.js'

interface ComboKey {
  tools: string
  uses: number
  successes: number
}

export class ToolOptimizer {
  private interactions: InteractionRecord[] = []

  constructor(existing?: InteractionRecord[]) {
    if (existing) {
      this.interactions = existing
    }
  }

  setInteractions(interactions: InteractionRecord[]): void {
    this.interactions = interactions
  }

  analyzeToolCombinations(): Map<string, { rate: number; uses: number }> {
    const comboMap = new Map<string, ComboKey>()

    for (const record of this.interactions) {
      if (record.toolsUsed.length < 2) continue

      const sorted = [...record.toolsUsed].sort()
      // Generate all pairs
      for (let i = 0; i < sorted.length; i++) {
        for (let j = i + 1; j < sorted.length; j++) {
          const key = `${sorted[i]}+${sorted[j]}`
          const combo = comboMap.get(key) ?? { tools: key, uses: 0, successes: 0 }
          combo.uses++
          if (record.success) combo.successes++
          comboMap.set(key, combo)
        }
      }
    }

    const result = new Map<string, { rate: number; uses: number }>()
    for (const [key, combo] of comboMap) {
      if (combo.uses >= 2) {
        result.set(key, {
          rate: combo.successes / combo.uses,
          uses: combo.uses,
        })
      }
    }

    return result
  }

  recommendToolsForTask(taskDescription: string): ToolRecommendation[] {
    const lower = taskDescription.toLowerCase()

    // Predefined task-tool affinity based on common patterns
    const taskToolAffinity: Record<string, { tools: string[]; keywords: string[] }> = {
      'code-reading': {
        tools: ['FileReadTool', 'GrepTool', 'GlobTool'],
        keywords: ['read', 'view', 'show', 'display', 'open', 'what', 'understand', 'explain'],
      },
      'code-editing': {
        tools: ['FileEditTool', 'FileWriteTool'],
        keywords: ['edit', 'change', 'modify', 'update', 'fix', 'refactor', 'rename'],
      },
      'code-creation': {
        tools: ['FileWriteTool', 'BashTool'],
        keywords: ['create', 'add', 'new', 'implement', 'build', 'write', 'scaffold'],
      },
      'searching': {
        tools: ['GrepTool', 'GlobTool', 'WebSearchTool'],
        keywords: ['search', 'find', 'where', 'locate', 'look for', 'grep'],
      },
      'testing': {
        tools: ['BashTool', 'FileWriteTool', 'FileEditTool'],
        keywords: ['test', 'spec', 'coverage', 'unit test', 'integration'],
      },
      'research': {
        tools: ['WebSearchTool', 'WebFetchTool', 'AgentTool'],
        keywords: ['research', 'investigate', 'explore', 'learn', 'documentation'],
      },
      'automation': {
        tools: ['BashTool', 'ScheduleCronTool', 'TaskCreateTool'],
        keywords: ['automate', 'schedule', 'cron', 'recurring', 'periodic'],
      },
      'debugging': {
        tools: ['BashTool', 'FileReadTool', 'GrepTool', 'MonitorTool'],
        keywords: ['debug', 'error', 'trace', 'log', 'diagnose', 'troubleshoot'],
      },
      'git-ops': {
        tools: ['BashTool'],
        keywords: ['git', 'commit', 'push', 'pull', 'branch', 'merge', 'rebase'],
      },
      'analysis': {
        tools: ['GrepTool', 'GlobTool', 'FileReadTool', 'AgentTool'],
        keywords: ['analyze', 'review', 'audit', 'assess', 'evaluate', 'report'],
      },
    }

    // Score each tool affinity against the task description
    const toolScores = new Map<string, { score: number; reason: string }>()

    for (const [, affinity] of Object.entries(taskToolAffinity)) {
      const matchedKeywords = affinity.keywords.filter(kw => lower.includes(kw))
      if (matchedKeywords.length > 0) {
        for (const tool of affinity.tools) {
          const existing = toolScores.get(tool) ?? { score: 0, reason: '' }
          existing.score += matchedKeywords.length
          existing.reason = `Matched: ${matchedKeywords.join(', ')}`
          toolScores.set(tool, existing)
        }
      }
    }

    // Boost scores with historical data
    for (const record of this.interactions.slice(-100)) {
      if (!record.success) continue
      const queryLower = record.query.toLowerCase()
      const overlap = lower.split(/\s+/).filter(w => w.length > 3 && queryLower.includes(w))
      if (overlap.length >= 2) {
        for (const tool of record.toolsUsed) {
          const existing = toolScores.get(tool) ?? { score: 0, reason: '' }
          existing.score += overlap.length
          if (!existing.reason) existing.reason = `Historical success with similar task`
          toolScores.set(tool, existing)
        }
      }
    }

    return [...toolScores.entries()]
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, 5)
      .map(([toolName, { score, reason }]) => ({
        toolName,
        confidence: Math.min(score / 10, 1),
        reason,
      }))
  }

  getToolStats(toolName: string): ToolUsageStats | null {
    const records = this.interactions.filter(r => r.toolsUsed.includes(toolName))
    if (records.length === 0) return null

    const successes = records.filter(r => r.success).length
    const totalDuration = records.reduce((sum, r) => sum + r.durationMs, 0)

    // Common combinations
    const comboMap = new Map<string, number>()
    for (const record of records) {
      const others = record.toolsUsed.filter(t => t !== toolName).sort()
      if (others.length > 0) {
        const key = others.join(',')
        comboMap.set(key, (comboMap.get(key) ?? 0) + 1)
      }
    }
    const commonCombinations = [...comboMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([combo]) => combo.split(','))

    return {
      toolName,
      totalUses: records.length,
      successRate: successes / records.length,
      avgDurationMs: totalDuration / records.length,
      commonCombinations,
      bestForTaskTypes: [],
    }
  }

  identifyUnderperformingTools(): { tool: string; successRate: number; uses: number }[] {
    const toolMap = new Map<string, { uses: number; successes: number }>()

    for (const record of this.interactions) {
      for (const tool of record.toolsUsed) {
        const stat = toolMap.get(tool) ?? { uses: 0, successes: 0 }
        stat.uses++
        if (record.success) stat.successes++
        toolMap.set(tool, stat)
      }
    }

    return [...toolMap.entries()]
      .map(([tool, stat]) => ({
        tool,
        successRate: stat.successes / stat.uses,
        uses: stat.uses,
      }))
      .filter(t => t.uses >= 3 && t.successRate < 0.5)
      .sort((a, b) => a.successRate - b.successRate)
  }

  suggestAlternatives(toolName: string): ToolRecommendation[] {
    const underperformer = this.getToolStats(toolName)
    if (!underperformer || underperformer.successRate >= 0.5) return []

    // Find tools that succeed in similar contexts
    const contextRecords = this.interactions.filter(r =>
      r.toolsUsed.includes(toolName)
    )

    const alternativeScores = new Map<string, { score: number; uses: number }>()
    for (const record of contextRecords) {
      for (const tool of record.toolsUsed) {
        if (tool === toolName) continue
        const alt = alternativeScores.get(tool) ?? { score: 0, uses: 0 }
        alt.uses++
        if (record.success) alt.score += 1
        alternativeScores.set(tool, alt)
      }
    }

    // Also find tools that succeed in successful interactions with similar queries
    const similarQueries = contextRecords.map(r => r.query)
    for (const record of this.interactions) {
      if (record.toolsUsed.includes(toolName)) continue
      if (!record.success) continue
      const hasOverlap = similarQueries.some(sq => {
        const words1 = new Set(sq.toLowerCase().split(/\s+/))
        const words2 = new Set(record.query.toLowerCase().split(/\s+/))
        let overlap = 0
        for (const w of words1) if (words2.has(w) && w.length > 3) overlap++
        return overlap >= 2
      })
      if (hasOverlap) {
        for (const tool of record.toolsUsed) {
          const alt = alternativeScores.get(tool) ?? { score: 0, uses: 0 }
          alt.score += 2
          alt.uses++
          alternativeScores.set(tool, alt)
        }
      }
    }

    return [...alternativeScores.entries()]
      .map(([toolName, { score, uses }]) => ({
        toolName,
        confidence: uses > 0 ? Math.min(score / uses, 1) : 0,
        reason: `Higher success rate in similar contexts (${uses} co-occurrences)`,
      }))
      .filter(r => r.confidence > 0.3)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3)
  }
}
