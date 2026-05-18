// Super-Agent Integration Service
// Wires all 9 autonomous capability modules into the core Mythos query flow.

export { SuperAgentOrchestrator, getSuperAgentOrchestrator, resetSuperAgentOrchestrator } from './orchestrator.js'
export type { SuperAgentConfig, SuperAgentState } from './types.js'
export { registerSuperAgentHooks } from './hooks.js'
export { augmentSystemPrompt } from './contextAugmenter.js'
