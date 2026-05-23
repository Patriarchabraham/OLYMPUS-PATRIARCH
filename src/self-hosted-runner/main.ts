/**
 * Self-Hosted Runner — Real job execution server for Mythos Patriarch.
 *
 * Accepts build/test/lint jobs via HTTP, queues them, executes in isolated
 * child processes with timeouts, streams output, and reports results.
 *
 * Usage:
 *   bun run src/self-hosted-runner/main.ts --port 3456
 *
 * Endpoints:
 *   POST /job          — Submit job { command, cwd?, timeout?, env? }
 *   GET  /job/:id      — Get job status + output
 *   GET  /jobs         — List all jobs
 *   DELETE /job/:id    — Cancel running job
 *   GET  /health       — Health check
 */

import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'http'
import { spawn, type ChildProcess } from 'child_process'
import { randomUUID } from 'crypto'

// ============================================================
// Types
// ============================================================

type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'

interface Job {
  id: string
  command: string
  args: string[]
  cwd: string
  env: Record<string, string>
  timeout: number
  status: JobStatus
  exitCode: number | null
  stdout: string
  stderr: string
  startTime: number | null
  endTime: number | null
  createdAt: number
  process: ChildProcess | null
}

interface SubmitPayload {
  command: string
  args?: string[]
  cwd?: string
  timeout?: number
  env?: Record<string, string>
}

// ============================================================
// Job Queue
// ============================================================

const MAX_OUTPUT_BYTES = 2 * 1024 * 1024 // 2MB output cap per stream

class JobQueue {
  private readonly jobs = new Map<string, Job>()
  private readonly queue: string[] = []
  private running = 0
  private readonly concurrency: number
  private shuttingDown = false
  private readonly onDrain?: () => void

  constructor(concurrency: number = 2, onDrain?: () => void) {
    this.concurrency = concurrency
    this.onDrain = onDrain
  }

  submit(payload: SubmitPayload): Job {
    const job: Job = {
      id: randomUUID(),
      command: payload.command,
      args: payload.args ?? [],
      cwd: payload.cwd ?? process.cwd(),
      env: { ...process.env as Record<string, string>, ...(payload.env ?? {}) },
      timeout: payload.timeout ?? 300_000, // 5 min default
      status: 'queued',
      exitCode: null,
      stdout: '',
      stderr: '',
      startTime: null,
      endTime: null,
      createdAt: Date.now(),
      process: null,
    }
    this.jobs.set(job.id, job)
    this.queue.push(job.id)
    this.scheduleNext()
    return job
  }

  get(id: string): Job | undefined {
    return this.jobs.get(id)
  }

  list(): Job[] {
    return Array.from(this.jobs.values()).map(j => ({ ...j }))
  }

  cancel(id: string): boolean {
    const job = this.jobs.get(id)
    if (!job) return false
    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') return false

    // Remove from queue if still queued
    const queueIdx = this.queue.indexOf(id)
    if (queueIdx !== -1) {
      this.queue.splice(queueIdx, 1)
    }

    // Kill process if running
    if (job.process && job.status === 'running') {
      job.process.kill('SIGTERM')
      this.running--
    }

    job.status = 'cancelled'
    job.endTime = Date.now()
    this.scheduleNext()
    return true
  }

  shutdown(): Promise<void> {
    this.shuttingDown = true
    return new Promise((resolve) => {
      const check = () => {
        if (this.running === 0) {
          resolve()
          return
        }
        setTimeout(check, 100)
      }
      // Give running jobs 10 seconds then force kill
      setTimeout(() => {
        const allJobs = Array.from(this.jobs.entries())
        for (const [, job] of allJobs) {
          if (job.status === 'running' && job.process) {
            job.process.kill('SIGKILL')
          }
        }
        resolve()
      }, 10_000)
      check()
    })
  }

  private scheduleNext(): void {
    if (this.shuttingDown) return
    while (this.running < this.concurrency && this.queue.length > 0) {
      const id = this.queue.shift()!
      const job = this.jobs.get(id)
      if (job && job.status === 'queued') {
        this.executeJob(job)
      }
    }
    // Notify when all done during shutdown
    if (this.shuttingDown && this.running === 0 && this.onDrain) {
      this.onDrain()
    }
  }

  private executeJob(job: Job): void {
    job.status = 'running'
    job.startTime = Date.now()
    this.running++

    try {
      const proc = spawn(job.command, job.args, {
        cwd: job.cwd,
        env: job.env,
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      job.process = proc

      // Stream stdout
      let stdoutLen = 0
      proc.stdout?.on('data', (chunk: Buffer) => {
        if (stdoutLen < MAX_OUTPUT_BYTES) {
          const str = chunk.toString()
          const remaining = MAX_OUTPUT_BYTES - stdoutLen
          job.stdout += str.substring(0, remaining)
          stdoutLen += Math.min(str.length, remaining)
        }
      })

      // Stream stderr
      let stderrLen = 0
      proc.stderr?.on('data', (chunk: Buffer) => {
        if (stderrLen < MAX_OUTPUT_BYTES) {
          const str = chunk.toString()
          const remaining = MAX_OUTPUT_BYTES - stderrLen
          job.stderr += str.substring(0, remaining)
          stderrLen += Math.min(str.length, remaining)
        }
      })

      // Timeout handling
      const timer = setTimeout(() => {
        if (job.process && job.status === 'running') {
          job.process.kill('SIGKILL')
          job.status = 'failed'
          job.stderr += '\n[runner] Job timed out\n'
          job.exitCode = -1
          job.endTime = Date.now()
          this.running--
          this.scheduleNext()
        }
      }, job.timeout)

      // Completion
      proc.on('close', (code: number | null) => {
        clearTimeout(timer)
        if (job.status === 'running') {
          job.status = code === 0 ? 'completed' : 'failed'
          job.exitCode = code
          job.endTime = Date.now()
          this.running--
          this.scheduleNext()
        }
      })

      proc.on('error', (err: Error) => {
        clearTimeout(timer)
        job.status = 'failed'
        job.stderr += `\n[runner] Process error: ${err.message}\n`
        job.exitCode = -1
        job.endTime = Date.now()
        this.running--
        this.scheduleNext()
      })
    } catch (err) {
      job.status = 'failed'
      job.stderr += `\n[runner] Spawn error: ${err instanceof Error ? err.message : String(err)}\n`
      job.exitCode = -1
      job.endTime = Date.now()
      this.running--
      this.scheduleNext()
    }
  }
}

// ============================================================
// HTTP Server
// ============================================================

function serializeJob(job: Job): Record<string, unknown> {
  return {
    id: job.id,
    command: job.command,
    args: job.args,
    cwd: job.cwd,
    timeout: job.timeout,
    status: job.status,
    exitCode: job.exitCode,
    stdout: job.stdout,
    stderr: job.stderr,
    startTime: job.startTime,
    endTime: job.endTime,
    createdAt: job.createdAt,
  }
}

function parseBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    const maxBody = 1024 * 1024 // 1MB

    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > maxBody) {
        req.destroy()
        reject(new Error('Body too large'))
        return
      }
      chunks.push(chunk)
    })

    req.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf-8'))
    })

    req.on('error', reject)
  })
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data)
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  })
  res.end(body)
}

function createRunnerServer(port: number): Server {
  const queue = new JobQueue(2)
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${port}`)
    const path = url.pathname
    const method = req.method ?? 'GET'

    try {
      // POST /job — submit job
      if (method === 'POST' && path === '/job') {
        parseBody(req).then((raw) => {
          let payload: SubmitPayload
          try {
            payload = JSON.parse(raw) as SubmitPayload
          } catch {
            sendJson(res, 400, { error: 'Invalid JSON' })
            return
          }

          if (!payload.command || typeof payload.command !== 'string') {
            sendJson(res, 400, { error: 'Missing "command" field' })
            return
          }

          const job = queue.submit(payload)
          sendJson(res, 201, serializeJob(job))
        }).catch(() => {
          sendJson(res, 400, { error: 'Failed to read request body' })
        })
        return
      }

      // GET /job/:id — get status
      const jobMatch = path.match(/^\/job\/([0-9a-f-]+)$/)
      if (method === 'GET' && jobMatch) {
        const id = jobMatch[1]!
        const job = queue.get(id)
        if (!job) {
          sendJson(res, 404, { error: 'Job not found' })
          return
        }
        sendJson(res, 200, serializeJob(job))
        return
      }

      // GET /jobs — list all
      if (method === 'GET' && path === '/jobs') {
        const jobs = queue.list().map(serializeJob)
        sendJson(res, 200, { jobs, count: jobs.length })
        return
      }

      // DELETE /job/:id — cancel
      const deleteMatch = path.match(/^\/job\/([0-9a-f-]+)$/)
      if (method === 'DELETE' && deleteMatch) {
        const id = deleteMatch[1]!
        const cancelled = queue.cancel(id)
        sendJson(res, cancelled ? 200 : 404, { cancelled, id })
        return
      }

      // GET /health
      if (method === 'GET' && path === '/health') {
        sendJson(res, 200, {
          status: 'ok',
          uptime: process.uptime(),
          jobs: queue.list().length,
          running: queue.list().filter(j => j.status === 'running').length,
          queued: queue.list().filter(j => j.status === 'queued').length,
        })
        return
      }

      sendJson(res, 404, { error: 'Not found' })
    } catch (err) {
      sendJson(res, 500, { error: err instanceof Error ? err.message : 'Internal error' })
    }
  })

  // Graceful shutdown
  let shuttingDown = false
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return
    shuttingDown = true
    console.log(`\n[runner] Received ${signal}, shutting down gracefully...`)

    await queue.shutdown()

    server.close(() => {
      console.log('[runner] Server closed')
      process.exit(0)
    })

    // Force exit after 15 seconds
    setTimeout(() => {
      console.log('[runner] Forced shutdown after timeout')
      process.exit(1)
    }, 15_000)
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))

  return server
}

// ============================================================
// Main entry
// ============================================================

/**
 * Start the self-hosted runner server.
 * Parses --port from args (default 3456).
 */
export async function selfHostedRunnerMain(args?: string[]): Promise<void> {
  const port = parsePort(args ?? [])
  const server = createRunnerServer(port)

  await new Promise<void>((resolve, reject) => {
    server.on('error', (err: Error) => {
      console.error(`[runner] Server error: ${err.message}`)
      reject(err)
    })

    server.listen(port, () => {
      console.log(`[runner] Self-hosted runner listening on http://localhost:${port}`)
      console.log('[runner] Endpoints: POST /job, GET /job/:id, GET /jobs, DELETE /job/:id, GET /health')
      resolve()
    })
  })

  // Keep process alive
  await new Promise<void>(() => {})
}

function parsePort(args: string[]): number {
  const portIdx = args.indexOf('--port')
  if (portIdx !== -1 && portIdx + 1 < args.length) {
    const p = Number(args[portIdx + 1])
    if (Number.isInteger(p) && p > 0 && p < 65536) return p
  }
  return 3456
}
