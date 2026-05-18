import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.mjs'
import type { Command } from '../../commands.js'
import { getSuperAgentOrchestrator } from '../../services/superAgent/index.js'

const command = {
  type: 'prompt',
  name: 'reason',
  description:
    'Activate deep reasoning mode — chain-of-thought, tree-of-thought, or self-reflection',
  isEnabled: () => true,
  progressMessage: 'activating reasoning engine',
  contentLength: 0,
  source: 'builtin',
  async getPromptForCommand(args?: string): Promise<ContentBlockParam[]> {
    const strategy = args?.trim() || 'auto'
    const validStrategies = ['auto', 'cot', 'tot', 'reflect']

    if (!validStrategies.includes(strategy)) {
      return [
        {
          type: 'text',
          text: `Invalid reasoning strategy "${strategy}". Valid options: ${validStrategies.join(', ')}`,
        },
      ]
    }

    // Try to run actual reasoning via the orchestrator
    const orchestrator = getSuperAgentOrchestrator()
    const state = orchestrator.getState()
    const moduleStatus = state.initialized && state.enabledModules.includes('reasoning')
      ? 'ACTIVE (integrated with query loop)'
      : 'STANDALONE (modules available but not yet initialized)'

    return [
      {
        type: 'text',
        text: `[Reasoning Engine Activated]

Strategy: ${strategy.toUpperCase()}
Module Status: ${moduleStatus}

You now have access to the deep reasoning engine. For every complex task:
1. Use chain-of-thought (cot) for sequential problem decomposition
2. Use tree-of-thought (tot) for exploring multiple solution paths
3. Use self-reflection (reflect) for verification and improvement loops

When reasoning:
- Break complex problems into explicit steps
- Evaluate multiple approaches before committing
- Verify your own work through self-reflection
- Show your reasoning process transparently

The reasoning engine is integrated into the query loop — strategy recommendations from the evolution system will inform which reasoning approach is most effective based on learned patterns.

Apply ${strategy === 'auto' ? 'the automatically selected' : `the ${strategy}`} reasoning strategy to all subsequent tasks.`,
      },
    ]
  },
} satisfies Command

export default command
