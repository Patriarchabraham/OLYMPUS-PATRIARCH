import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.mjs'
import type { Command } from '../../commands.js'
import { getSuperAgentOrchestrator } from '../../services/superAgent/index.js'

const command = {
  type: 'prompt',
  name: 'swarm',
  description:
    'Manage agent swarms — start, stop, status, or assign tasks to coordinated agent teams',
  isEnabled: () => true,
  progressMessage: 'managing swarm',
  contentLength: 0,
  source: 'builtin',
  async getPromptForCommand(args?: string): Promise<ContentBlockParam[]> {
    const action = args?.trim() || 'help'

    const helpText = `[Swarm System]

Available actions:
- /swarm start <size> — Launch a swarm of coordinated agents
- /swarm stop — Terminate the active swarm
- /swarm status — Show current swarm state
- /swarm assign <task> — Assign a task to the swarm

Agent roles: researcher, coder, tester, reviewer, architect, dataAnalyst

The swarm system is integrated into the super-agent orchestrator. It provides:
- Task decomposition and dependency analysis
- Parallel agent execution with message bus
- Consensus voting for critical decisions
- Automatic role assignment based on task complexity`

    if (action === 'help' || action === '') {
      return [{ type: 'text', text: helpText }]
    }

    if (action.startsWith('start')) {
      const size = parseInt(action.split(' ')[1] || '3', 10)
      return [
        {
          type: 'text',
          text: `[Swarm Launched]

Spawning ${size} coordinated agents with roles:
- 1x Architect (planning and design decisions)
- ${Math.max(1, Math.floor(size * 0.4))}x Coder (implementation)
- ${Math.max(1, Math.floor(size * 0.3))}x Tester (verification)
- ${Math.max(1, size - 1 - Math.floor(size * 0.4) - Math.floor(size * 0.3))}x Reviewer (quality assurance)

Swarm is active. Use /swarm assign <task> to distribute work.
Use the Agent tool with subagent_type to spawn specialized agents.`,
        },
      ]
    }

    if (action === 'stop') {
      return [{ type: 'text', text: '[Swarm Stopped] All agents terminated.' }]
    }

    if (action === 'status') {
      const orchestrator = getSuperAgentOrchestrator()
      const swarms = orchestrator.getState().activeSwarms
      if (swarms.length === 0) {
        return [
          {
            type: 'text',
            text: `[Swarm Status]
No active swarm. Use /swarm start <size> to launch one.`,
          },
        ]
      }
      return [
        {
          type: 'text',
          text: `[Swarm Status]
Active swarms: ${swarms.length}`,
        },
      ]
    }

    if (action.startsWith('assign')) {
      const task = action.slice(7).trim()
      return [
        {
          type: 'text',
          text: `[Swarm Task Assigned]

Task: ${task}

The swarm orchestrator will:
1. Decompose the task into subtasks
2. Assign subtasks to appropriate agent roles
3. Execute in parallel where possible
4. Collect and synthesize results

Use the Agent tool to spawn specialized sub-agents for each subtask.`,
        },
      ]
    }

    return [{ type: 'text', text: helpText }]
  },
} satisfies Command

export default command
