import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.mjs'
import type { Command } from '../../commands.js'
import { getSuperAgentOrchestrator } from '../../services/superAgent/index.js'

const command = {
  type: 'prompt',
  name: 'goals',
  description:
    'Manage project goals — create, list, prioritize, and track autonomous goals',
  isEnabled: () => true,
  progressMessage: 'managing goals',
  contentLength: 0,
  source: 'builtin',
  async getPromptForCommand(args?: string): Promise<ContentBlockParam[]> {
    const action = args?.trim() || 'list'
    const orchestrator = getSuperAgentOrchestrator()
    const runner = orchestrator.getAutonomousRunner()

    if (action === 'list' || action === '') {
      if (!runner) {
        return [
          {
            type: 'text',
            text: `[Goal Manager] Autonomous system not initialized.`,
          },
        ]
      }

      const goals = runner.listGoals()
      if (goals.length === 0) {
        return [
          {
            type: 'text',
            text: `[Goal Manager]

No goals currently tracked. Use /goals add <title> to create one.`,
          },
        ]
      }

      const goalList = goals
        .map(g => `- [${g.status}] ${g.title} (priority: ${g.priority})`)
        .join('\n')

      return [
        {
          type: 'text',
          text: `[Goal Manager]

${goalList}

Use /goals add <title> to create a new goal.`,
        },
      ]
    }

    if (action.startsWith('add ')) {
      const title = action.slice(4).trim()
      if (!title) {
        return [{ type: 'text', text: '[Goal Manager] Usage: /goals add <title>' }]
      }

      const goal = orchestrator.createGoal(title, `Auto-created goal: ${title}`)
      if (!goal) {
        return [
          { type: 'text', text: '[Goal Manager] Failed to create goal — autonomous system not initialized.' },
        ]
      }

      return [
        {
          type: 'text',
          text: `[Goal Created]

Title: ${goal.title}
ID: ${goal.id}
Status: ${goal.status}
Priority: ${goal.priority}
Milestones: ${goal.milestones.length}

The autonomous task runner will:
1. Decompose this goal into milestones
2. Execute each milestone with checkpoints
3. Auto-recover from errors
4. Track progress and report`,
        },
      ]
    }

    if (action.startsWith('done ')) {
      const id = action.slice(5).trim()
      const result = runner?.completeGoal(id, 'Completed by user')
      if (!result) {
        return [{ type: 'text', text: `[Goal Manager] Goal "${id}" not found.` }]
      }
      return [{ type: 'text', text: `[Goal Manager] Goal "${result.title}" marked as completed.` }]
    }

    if (action === 'prioritize') {
      const queue = runner?.getPriorityQueue()
      if (!queue || queue.length === 0) {
        return [{ type: 'text', text: '[Goal Manager] No goals to prioritize.' }]
      }
      const list = queue.map((g, i) => `${i + 1}. ${g.title} (priority: ${g.priority})`).join('\n')
      return [{ type: 'text', text: `[Goal Manager] Priority Queue:\n${list}` }]
    }

    return [
      {
        type: 'text',
        text: `[Goal Manager] Unknown action. Use: list, add, done, prioritize`,
      },
    ]
  },
} satisfies Command

export default command
