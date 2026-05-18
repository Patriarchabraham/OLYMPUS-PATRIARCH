/**
 * SuperAgent Initialization
 *
 * Extracted from main.tsx to keep startup logic modular.
 * Initializes the SuperAgent orchestrator and registers its hooks.
 */

import { getSuperAgentOrchestrator, registerSuperAgentHooks } from '../../services/superAgent/index.js';
import { isEnvTruthy } from '../envUtils.js';

/**
 * Initialize super-agent subsystems (reasoning, evolution, RAG, swarm, etc.).
 * Non-critical — super-agent subsystems are optional enhancements.
 *
 * @param dataDir - The working directory used as the super-agent data root.
 */
export function initSuperAgent(dataDir: string): void {
  if (isEnvTruthy(process.env.CLAUDE_CODE_DISABLE_SUPER_AGENT)) {
    return;
  }
  try {
    const superAgent = getSuperAgentOrchestrator({ dataDir });
    void superAgent.initialize();
    registerSuperAgentHooks();
  } catch {
    // Non-critical — super-agent subsystems are optional enhancements
  }
}
