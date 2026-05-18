import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs'
import { join } from 'path'
import { getCwd } from './utils/cwd.js'
import { isDirEmpty } from './utils/file.js'
import { getFsImplementation } from './utils/fsOperations.js'
import { findProjectInstructionFilePathInAncestors } from './utils/projectInstructions.js'
import { getSuperAgentOrchestrator } from './services/superAgent/orchestrator.js'
import { generatePlanFromDescription } from './planning/projectPlanner.js'
import { exportPlan } from './planning/projectPlanner.js'

export type Step = {
  key: string
  text: string
  isComplete: boolean
  isCompletable: boolean
  isEnabled: boolean
}

/**
 * Check whether the project directory has already been indexed for RAG.
 * Looks for a .mythos/rag-indexed sentinel file.
 */
function isRAGIndexed(): boolean {
  const cwd = getCwd()
  return existsSync(join(cwd, '.mythos', 'rag-indexed'))
}

/**
 * Check whether a project plan has been generated during onboarding.
 * Looks for a .mythos/plan.json sentinel file.
 */
function isPlanGenerated(): boolean {
  const cwd = getCwd()
  return existsSync(join(cwd, '.mythos', 'plan.json'))
}

/**
 * Read the repo instructions file content for plan generation context.
 */
function getRepoInstructionsContent(): string {
  const cwd = getCwd()
  const candidates = ['AGENTS.md', 'CLAUDE.md', '.claude/AGENTS.md', '.claude/CLAUDE.md']
  for (const name of candidates) {
    const filePath = join(cwd, name)
    if (existsSync(filePath)) {
      try {
        return readFileSync(filePath, 'utf-8')
      } catch {
        continue
      }
    }
  }
  return ''
}

/**
 * Trigger RAG indexing of the project directory via the super-agent orchestrator.
 * Creates a sentinel file on success so the onboarding step shows as complete.
 */
export async function runRAGIndexingStep(): Promise<{ documents: number; chunks: number } | null> {
  const orchestrator = getSuperAgentOrchestrator()
  const result = await orchestrator.indexDirectory(getCwd())
  if (result) {
    const dir = join(getCwd(), '.mythos')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'rag-indexed'), `${result.documents} docs, ${result.chunks} chunks`, 'utf-8')
  }
  return result
}

/**
 * Auto-generate a project plan from the repo instructions and project description.
 * Uses generatePlanFromDescription from the planning module and persists the result.
 */
export function runPlanGenerationStep(description?: string): string | null {
  const cwd = getCwd()
  const planDescription = description ?? getRepoInstructionsContent()

  if (!planDescription.trim()) {
    return null
  }

  try {
    const plan = generatePlanFromDescription(planDescription)
    const dir = join(cwd, '.mythos')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

    // Persist as JSON for machine consumption
    writeFileSync(join(dir, 'plan.json'), exportPlan(plan.id, 'json'), 'utf-8')

    // Persist as Markdown for human consumption
    writeFileSync(join(dir, 'plan.md'), exportPlan(plan.id, 'markdown'), 'utf-8')

    return plan.id
  } catch {
    return null
  }
}

export function getSteps(): Step[] {
  const hasRepoInstructions =
    findProjectInstructionFilePathInAncestors(
      getCwd(),
      getFsImplementation().existsSync,
    ) !== null
  const isWorkspaceDirEmpty = isDirEmpty(getCwd())

  return [
    {
      key: 'workspace',
      text: 'Ask Claude to create a new app or clone a repository',
      isComplete: false,
      isCompletable: true,
      isEnabled: isWorkspaceDirEmpty,
    },
    {
      key: 'claudemd',
      text: 'Set up repo instructions (/init creates AGENTS.md or updates existing CLAUDE.md; either file counts)',
      isComplete: hasRepoInstructions,
      isCompletable: true,
      isEnabled: !isWorkspaceDirEmpty,
    },
    {
      key: 'plan',
      text: 'Generate a project plan with objectives, milestones, and phases',
      isComplete: isPlanGenerated(),
      isCompletable: true,
      isEnabled: !isWorkspaceDirEmpty,
    },
    {
      key: 'rag-index',
      text: 'Index project for semantic search (RAG) so Claude can retrieve relevant code context',
      isComplete: isRAGIndexed(),
      isCompletable: true,
      isEnabled: !isWorkspaceDirEmpty,
    },
  ]
}

export function isProjectOnboardingComplete(): boolean {
  return getSteps()
    .filter(({ isCompletable, isEnabled }) => isCompletable && isEnabled)
    .every(({ isComplete }) => isComplete)
}
