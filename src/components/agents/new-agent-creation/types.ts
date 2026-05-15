import type { AgentDefinition, CustomAgentDefinition } from '../../../tools/AgentTool/loadAgentsDir.js'
import type { Tools } from '../../../Tool.js'
import type { SettingSource } from '../../../utils/settings/constants.js'
import type { AgentMemoryScope } from '../../../tools/AgentTool/agentMemory.js'

export type AgentCreationMethod = 'guided' | 'manual'

export type GeneratedAgentResult = {
  identifier: string
  whenToUse: string
  systemPrompt: string
}

export type AgentWizardData = {
  // Step 1: Type
  creationMethod?: AgentCreationMethod
  existingAgentName?: string
  agentType?: string

  // Step 2: Description
  description?: string
  whenToUse?: string

  // Step 3: Prompt
  prompt?: string
  systemPrompt?: string

  // Step 4: Model
  model?: string

  // Step 5: Color
  color?: string

  // Step 6: Tools
  selectedTools?: string[]

  // Step 7: Memory
  enableMemory?: boolean
  selectedMemory?: AgentMemoryScope

  // Step 8: Location
  location?: SettingSource

  // Step 9: Generate
  confirmed?: boolean
  generationPrompt?: string
  isGenerating?: boolean
  wasGenerated?: boolean
  generatedAgent?: GeneratedAgentResult

  // Final assembled agent for confirmation
  finalAgent?: CustomAgentDefinition
}
