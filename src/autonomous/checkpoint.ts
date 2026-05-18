import { randomUUID } from 'crypto'
import { mkdir, readFile, writeFile, unlink, readdir } from 'fs/promises'
import { join } from 'path'
import type { Checkpoint } from './types.js'

const DEFAULT_CHECKPOINTS_DIR = '.mythos/autonomous/checkpoints'

// Configurable base directory for persistence (set by AutonomousRunner)
let configuredBaseDir: string | undefined

/**
 * Set the base directory for checkpoint storage.
 * Called by AutonomousRunner during initialization.
 */
export function setCheckpointsBaseDir(baseDir: string): void {
  configuredBaseDir = baseDir
}

function getCheckpointsDir(baseDir?: string): string {
  const effectiveBase = baseDir ?? configuredBaseDir ?? process.cwd()
  return join(effectiveBase, DEFAULT_CHECKPOINTS_DIR)
}

function checkpointPath(baseDir: string, checkpointId: string): string {
  return join(baseDir, `${checkpointId}.json`)
}

function goalCheckpointPattern(goalId: string): RegExp {
  return new RegExp(`^${goalId}-`)
}

export function createCheckpoint(
  goalId: string,
  milestoneId: string,
  stepIndex: number,
  state: Record<string, unknown>,
  summary: string = '',
  filesSnapshot?: string[],
): Checkpoint {
  return {
    id: `${goalId}-${milestoneId}-${stepIndex}-${randomUUID().slice(0, 8)}`,
    goalId,
    milestoneId,
    stepIndex,
    state,
    filesSnapshot,
    timestamp: Date.now(),
    summary,
  }
}

export async function saveCheckpoint(
  checkpoint: Checkpoint,
  baseDir: string = process.cwd(),
): Promise<void> {
  const dir = getCheckpointsDir(baseDir)
  await mkdir(dir, { recursive: true })
  const filePath = checkpointPath(dir, checkpoint.id)
  await writeFile(filePath, JSON.stringify(checkpoint, null, 2), 'utf-8')
}

export async function loadCheckpoint(
  goalId: string,
  baseDir: string = process.cwd(),
): Promise<Checkpoint | null> {
  const checkpoints = await listCheckpoints(goalId, baseDir)
  if (checkpoints.length === 0) return null

  // Return the latest checkpoint for this goal
  checkpoints.sort((a, b) => b.timestamp - a.timestamp)
  return checkpoints[0] ?? null
}

export async function listCheckpoints(
  goalId: string,
  baseDir: string = process.cwd(),
): Promise<Checkpoint[]> {
  const dir = getCheckpointsDir(baseDir)
  try {
    const files = await readdir(dir)
    const pattern = goalCheckpointPattern(goalId)
    const checkpointFiles = files.filter(f => pattern.test(f))

    const checkpoints: Checkpoint[] = []
    for (const file of checkpointFiles) {
      const content = await readFile(join(dir, file), 'utf-8')
      checkpoints.push(JSON.parse(content) as Checkpoint)
    }

    return checkpoints.sort((a, b) => a.timestamp - b.timestamp)
  } catch {
    return []
  }
}

export async function deleteCheckpoint(
  checkpointId: string,
  baseDir: string = process.cwd(),
): Promise<void> {
  const dir = getCheckpointsDir(baseDir)
  const filePath = checkpointPath(dir, checkpointId)
  try {
    await unlink(filePath)
  } catch {
    // Already deleted or never existed
  }
}

export async function restoreFromCheckpoint(
  checkpoint: Checkpoint,
): Promise<Record<string, unknown>> {
  // Return the saved state so the caller can restore execution context.
  // The actual restoration logic is task-specific and handled by the task runner.
  return checkpoint.state
}

export async function clearGoalCheckpoints(
  goalId: string,
  baseDir: string = process.cwd(),
): Promise<void> {
  const checkpoints = await listCheckpoints(goalId, baseDir)
  const dir = getCheckpointsDir(baseDir)
  await Promise.all(
    checkpoints.map(cp => unlink(checkpointPath(dir, cp.id)).catch(() => {})),
  )
}
