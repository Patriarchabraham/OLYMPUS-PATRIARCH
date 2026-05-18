import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.mjs'
import type { Command } from '../../commands.js'
import { getSuperAgentOrchestrator } from '../../services/superAgent/index.js'

const command = {
  type: 'prompt',
  name: 'visualize',
  description:
    'Generate code visualizations — flowcharts, sequence diagrams, class diagrams, dependency graphs',
  isEnabled: () => true,
  progressMessage: 'generating visualization',
  contentLength: 0,
  source: 'builtin',
  async getPromptForCommand(args?: string): Promise<ContentBlockParam[]> {
    const type = args?.trim() || 'help'
    const orchestrator = getSuperAgentOrchestrator()
    const multimodalAvailable = orchestrator.isModuleEnabled('multimodal')

    if (type === 'help') {
      return [
        {
          type: 'text',
          text: `[Code Visualization]

Usage:
- /visualize flowchart <file> — Generate a flowchart
- /visualize sequence <description> — Sequence diagram
- /visualize class <file> — Class diagram
- /visualize deps — Dependency graph
- /visualize calltree <entry> — Call tree

Module Status: ${multimodalAvailable ? 'ACTIVE' : 'STANDALONE'}

The visualization module generates Mermaid diagram syntax integrated with the multimodal system. Output can be rendered in any Mermaid viewer.`,
        },
      ]
    }

    return [
      {
        type: 'text',
        text: `[Visualization: ${type}]

Generating visualization using the code visualizer.
The output will be in Mermaid diagram syntax.`,
      },
    ]
  },
} satisfies Command

export default command
