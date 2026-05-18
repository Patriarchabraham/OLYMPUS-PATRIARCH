import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.mjs'
import type { Command } from '../../commands.js'
import { getSuperAgentOrchestrator } from '../../services/superAgent/index.js'

const command = {
  type: 'prompt',
  name: 'evolve',
  description:
    'Trigger self-improvement — learn from recent interactions and evolve strategies',
  isEnabled: () => true,
  progressMessage: 'evolving strategies',
  contentLength: 0,
  source: 'builtin',
  async getPromptForCommand(): Promise<ContentBlockParam[]> {
    // Trigger actual evolution via the orchestrator
    const orchestrator = getSuperAgentOrchestrator()
    const state = orchestrator.getState()
    const report = orchestrator.getEvolutionReport()

    const interactionsTracked = report?.totalInteractions ?? 0
    const patternsLearned = report?.patternsLearned ?? 0
    const overallSuccess = report?.overallSuccessRate
      ? `${(report.overallSuccessRate * 100).toFixed(0)}%`
      : 'N/A'
    const toolInsights = report?.toolInsights ?? []

    let insightsText = ''
    if (toolInsights.length > 0) {
      insightsText = `\n\nTool Insights:\n${toolInsights.map(i => `- ${i}`).join('\n')}`
    }

    // Trigger an evolution cycle
    const evolveResult = await orchestrator.evolve()
    const newPatterns = evolveResult?.patternsLearned ?? 0

    return [
      {
        type: 'text',
        text: `[Evolution System Activated]

**Evolution Cycle Complete**

Statistics:
- Total interactions tracked: ${interactionsTracked}
- Patterns learned: ${patternsLearned} (+${newPatterns} new)
- Overall success rate: ${overallSuccess}
- Evolution cycles run: ${report?.evolutionCount ?? 0}
- Modules active: ${state.enabledModules.join(', ')}${insightsText}

The evolution system is integrated into the query loop — it automatically:
1. Tracks every tool call and strategy used
2. Learns patterns from successful interactions
3. Recommends optimal strategies and tools for new queries
4. Evolves system prompt sections based on effectiveness data

Data is persisted across sessions.`,
      },
    ]
  },
} satisfies Command

export default command
