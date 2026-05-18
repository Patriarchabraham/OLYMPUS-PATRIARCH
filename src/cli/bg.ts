/**
 * Named Background Delegations for the Mythos CLI.
 *
 * Provides the `claude ps`, `claude logs`, `claude attach`, `claude kill`
 * sub-commands and the `--bg`/`--background` flag handler.
 *
 * These handlers operate in a headless CLI context (no REPL, no live
 * AppState). They read from the ~/.claude/sessions/ PID file registry
 * and the task output files on disk.
 */

import { readFile, readdir, stat, unlink, writeFile } from 'fs/promises'
import { join } from 'path'
import { spawn } from 'child_process'
import { createInterface } from 'readline'
import { generateWordSlug } from '../utils/words.js'
import { getClaudeConfigHomeDir } from '../utils/envUtils.js'
import { isProcessRunning } from '../utils/genericProcessUtils.js'
import { getTaskOutputPath } from '../utils/task/diskOutput.js'
import { jsonParse, jsonStringify } from '../utils/slowOperations.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PidFileData = {
  pid: number
  sessionId: string
  cwd: string
  startedAt: number
  kind: 'interactive' | 'bg' | 'daemon' | 'daemon-worker'
  entrypoint?: string
  name?: string
  logPath?: string
  agent?: string
  status?: 'busy' | 'idle' | 'waiting'
  updatedAt?: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSessionsDir(): string {
  return join(getClaudeConfigHomeDir(), 'sessions')
}

/**
 * Read all live session PID files from the registry.
 * Filters out stale (dead process) entries and returns parsed data.
 */
async function readLiveSessions(): Promise<PidFileData[]> {
  const dir = getSessionsDir()
  let files: string[]
  try {
    files = await readdir(dir)
  } catch {
    return []
  }

  const sessions: PidFileData[] = []
  for (const file of files) {
    if (!/^\d+\.json$/.test(file)) continue
    const pid = parseInt(file.slice(0, -5), 10)
    if (isNaN(pid)) continue

    // Skip dead processes
    if (!isProcessRunning(pid)) {
      // Sweep stale file
      void unlink(join(dir, file)).catch(() => {})
      continue
    }

    try {
      const raw = await readFile(join(dir, file), 'utf8')
      const data = jsonParse(raw) as PidFileData
      sessions.push(data)
    } catch {
      // Corrupted or unreadable file — skip
    }
  }

  return sessions.sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0))
}

/**
 * Find a session by slug name, task ID, or session ID.
 */
async function findSession(
  slugOrId: string,
): Promise<PidFileData | undefined> {
  const sessions = await readLiveSessions()
  return (
    sessions.find(s => s.name === slugOrId) ??
    sessions.find(s => s.sessionId === slugOrId) ??
    sessions.find(s => String(s.pid) === slugOrId)
  )
}

/**
 * Format elapsed time as a human-readable duration.
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (minutes < 60) return `${minutes}m${remainingSeconds}s`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}h${remainingMinutes}m`
}

/**
 * Resolve the log path for a session.
 */
function resolveLogPath(session: PidFileData): string | undefined {
  if (session.logPath) return session.logPath
  // Default task output path uses the session ID
  return getTaskOutputPath(session.sessionId)
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/**
 * `claude ps` — list all running background sessions with their slug names,
 * status, and descriptions.
 */
export async function psHandler(_args?: string[]): Promise<void> {
  const sessions = await readLiveSessions()

  if (sessions.length === 0) {
    console.log('No running sessions.')
    return
  }

  const now = Date.now()
  let index = 1
  for (const session of sessions) {
    const slug = session.name ?? '(unnamed)'
    const status = session.status ?? 'idle'
    const elapsed = formatDuration(now - (session.startedAt ?? now))
    const kind = session.kind ?? 'interactive'
    const agent = session.agent ? ` [${session.agent}]` : ''
    const cwd = session.cwd ? ` in ${session.cwd}` : ''

    console.log(
      `[${index}] ${slug} (${status}, ${elapsed})${agent}${cwd}`,
    )
    index++
  }
}

/**
 * `claude logs <taskIdOrSlug>` — dump output from a named task's output file.
 * Supports both slug names and session/task IDs.
 */
export async function logsHandler(
  taskIdOrSlug?: string,
): Promise<void> {
  if (!taskIdOrSlug) {
    console.error('Usage: claude logs <slug|sessionId>')
    process.exitCode = 1
    return
  }

  const session = await findSession(taskIdOrSlug)
  if (!session) {
    // Even if the process is dead, try to read the log file
    const logPath = getTaskOutputPath(taskIdOrSlug)
    try {
      const content = await readFile(logPath, 'utf8')
      if (content) {
        console.log(content)
        return
      }
    } catch {
      // Fall through to error
    }

    console.error(`No session found for: ${taskIdOrSlug}`)
    process.exitCode = 1
    return
  }

  const logPath = resolveLogPath(session)
  if (!logPath) {
    console.error(`No log path available for session: ${taskIdOrSlug}`)
    process.exitCode = 1
    return
  }

  try {
    const content = await readFile(logPath, 'utf8')
    if (!content) {
      console.log(`(no output yet)`)
      return
    }
    console.log(content)
  } catch (e: unknown) {
    const code = (e as NodeJS.ErrnoException).code
    if (code === 'ENOENT') {
      console.log(`(no output file yet)`)
      return
    }
    console.error(`Failed to read log for ${taskIdOrSlug}: ${(e as Error).message}`)
    process.exitCode = 1
  }
}

/**
 * `claude attach <taskIdOrSlug>` — attach to a running task's output stream,
 * showing live output until the task completes or the user detaches (Ctrl+C).
 */
export async function attachHandler(
  taskIdOrSlug?: string,
): Promise<void> {
  if (!taskIdOrSlug) {
    console.error('Usage: claude attach <slug|sessionId>')
    process.exitCode = 1
    return
  }

  const session = await findSession(taskIdOrSlug)
  if (!session) {
    console.error(`No session found for: ${taskIdOrSlug}`)
    process.exitCode = 1
    return
  }

  const logPath = resolveLogPath(session)
  if (!logPath) {
    console.error(`No log path available for session: ${taskIdOrSlug}`)
    process.exitCode = 1
    return
  }

  const slug = session.name ?? session.sessionId
  console.log(`Attaching to ${slug} (PID ${session.pid})... (Ctrl+C to detach)\n`)

  let offset = 0
  // Start from the current end of the file (tail mode)
  try {
    const fileStat = await stat(logPath)
    offset = fileStat.size
  } catch {
    // File doesn't exist yet — start from 0
  }

  let running = true

  // Handle Ctrl+C to detach gracefully
  const rl = createInterface({ input: process.stdin })
  const onSigint = (): void => {
    running = false
    console.log(`\nDetached from ${slug}`)
    cleanup()
  }

  const cleanup = (): void => {
    rl.close()
    process.removeListener('SIGINT', onSigint)
  }

  process.on('SIGINT', onSigint)
  rl.on('close', () => {
    if (running) {
      running = false
      console.log(`\nDetached from ${slug}`)
    }
  })

  // Poll for new output
  while (running) {
    // Check if the process is still alive
    if (!isProcessRunning(session.pid)) {
      // Flush remaining output
      try {
        const content = await readFile(logPath, 'utf8')
        const newContent = content.slice(offset)
        if (newContent) {
          process.stdout.write(newContent)
        }
        offset = content.length
      } catch {
        // Ignore
      }
      console.log(`\nSession ${slug} has ended.`)
      cleanup()
      return
    }

    try {
      const content = await readFile(logPath, 'utf8')
      const newContent = content.slice(offset)
      if (newContent) {
        process.stdout.write(newContent)
        offset = content.length
      }
    } catch {
      // File might not exist yet — retry on next poll
    }

    // Wait before polling again
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  cleanup()
}

/**
 * `claude kill <taskIdOrSlug>` — kill a named task using the existing
 * session's PID. Supports both slug names and session/task IDs.
 */
export async function killHandler(
  taskIdOrSlug?: string,
): Promise<void> {
  if (!taskIdOrSlug) {
    console.error('Usage: claude kill <slug|sessionId>')
    process.exitCode = 1
    return
  }

  const session = await findSession(taskIdOrSlug)
  if (!session) {
    console.error(`No session found for: ${taskIdOrSlug}`)
    process.exitCode = 1
    return
  }

  const slug = session.name ?? session.sessionId
  const pid = session.pid

  if (!isProcessRunning(pid)) {
    console.log(`Session ${slug} (PID ${pid}) is not running.`)
    // Clean up the stale PID file
    const pidFile = join(getSessionsDir(), `${pid}.json`)
    void unlink(pidFile).catch(() => {})
    return
  }

  try {
    process.kill(pid, 'SIGTERM')
    console.log(`Sent SIGTERM to ${slug} (PID ${pid})`)
  } catch (e: unknown) {
    // On Windows or when permissions deny SIGTERM, try SIGKILL equivalent
    try {
      process.kill(pid, 0) // Check if still running
      // Still running — force kill
      if (process.platform === 'win32') {
        // On Windows, use taskkill for a clean termination
        const killer = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], {
          stdio: 'ignore',
        })
        killer.on('exit', code => {
          if (code === 0) {
            console.log(`Killed ${slug} (PID ${pid})`)
          } else {
            console.error(`Failed to kill ${slug} (PID ${pid})`)
          }
        })
        return
      }
      process.kill(pid, 'SIGKILL')
      console.log(`Sent SIGKILL to ${slug} (PID ${pid})`)
    } catch {
      console.error(
        `Failed to kill ${slug} (PID ${pid}): ${(e as Error).message}`,
      )
      process.exitCode = 1
      return
    }
  }

  // Clean up the PID file
  const pidFile = join(getSessionsDir(), `${pid}.json`)
  void unlink(pidFile).catch(() => {})
}

/**
 * `--bg` / `--background` flag handler — spawn a background claude session
 * with an auto-generated slug name using generateWordSlug().
 *
 * The spawned child process runs in detached mode with environment variables
 * set so it registers itself in the session PID file registry as kind='bg'.
 */
export async function handleBgFlag(args: string[]): Promise<void> {
  // Extract the prompt/description from args, stripping --bg/--background
  const filteredArgs = args.filter(
    a => a !== '--bg' && a !== '--background',
  )

  // Generate a memorable slug name
  const slugName = generateWordSlug()

  // Build the command to spawn
  // The child process will be `claude` with the remaining args
  const promptParts: string[] = []
  const flagParts: string[] = []

  for (const arg of filteredArgs) {
    if (arg.startsWith('-')) {
      flagParts.push(arg)
    } else {
      promptParts.push(arg)
    }
  }

  const prompt = promptParts.join(' ')
  const description = prompt || slugName

  // Set up environment for the background session
  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    CLAUDE_CODE_SESSION_KIND: 'bg',
    CLAUDE_CODE_SESSION_NAME: slugName,
    CLAUDE_CODE_SESSION_LOG: '', // Will be set by the child when it initializes
  }

  // If there's a prompt, pass it via -p flag for non-interactive mode
  const childArgs: string[] = [...flagParts]
  if (prompt) {
    childArgs.push('-p', prompt)
  }

  // Determine the claude binary
  const claudeBin = process.execPath

  // Write an initial PID file for the background session
  // The child will overwrite it with the actual PID via registerSession()
  const sessionsDir = getSessionsDir()
  const pidFile = join(sessionsDir, `${process.pid}.json`)

  try {
    const { mkdir } = await import('fs/promises')
    const { chmod } = await import('fs/promises')
    await mkdir(sessionsDir, { recursive: true, mode: 0o700 })
    await chmod(sessionsDir, 0o700)
  } catch {
    // Directory may already exist
  }

  // Spawn the child process
  const child = spawn(claudeBin, childArgs, {
    env,
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  })

  // Detach so the parent can exit independently
  child.unref()

  // Write the PID file immediately with the child's PID
  try {
    await writeFile(
      pidFile,
      jsonStringify({
        pid: child.pid ?? process.pid,
        sessionId: slugName,
        cwd: process.cwd(),
        startedAt: Date.now(),
        kind: 'bg',
        name: slugName,
      }),
    )
  } catch {
    // Best effort — the child will write its own
  }

  console.log(`Background session started: ${slugName}`)
  console.log(`  PID: ${child.pid}`)
  if (description !== slugName) {
    console.log(`  Task: "${description}"`)
  }
  console.log(`\nUse these commands to manage:`)
  console.log(`  claude ps          List running sessions`)
  console.log(`  claude logs ${slugName}    View output`)
  console.log(`  claude attach ${slugName}  Follow output live`)
  console.log(`  claude kill ${slugName}   Stop the session`)
}
