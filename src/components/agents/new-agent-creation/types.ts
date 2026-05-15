import type { AgentDefinition } from '../../../tools/AgentTool/loadAgentsDir.js'
import type { Tools } from '../../../Tool.js'

export type AgentCreationMethod = 'guided' | 'manual'

export type AgentWizardData = {
  // Step 1: Type
  creationMethod?: AgentCreationMethod
  existingAgentName?: string

  // Step 2: Description
  description?: string

  // Step 3: Prompt
  prompt?: string

  // Step 4: Model
  model?: string

  // Step 5: Color
  color?: string

  // Step 6: Tools
  selectedTools?: string[]

  // Step 7: Memory
  enableMemory?: boolean

  // Step 8: Location
  location?: 'project' | 'user'

  // Step 9: Generate (confirmation)
  confirmed?: boolean
}
