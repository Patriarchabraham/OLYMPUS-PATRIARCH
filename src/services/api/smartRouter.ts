/**
 * TypeScript bridge to the Python smart router.
 * Communicates via stdin/stdout JSON-RPC over execa.
 */

import { execa } from 'execa'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

export interface RouterProvider {
  name: string
  healthy: boolean
  latency_ms: number
  cost_per_1k_tokens: number
}

export interface RouteResult {
  provider: string
  model: string
  strategy: string
  candidates_evaluated: number
}

export interface RouterHealth {
  providers: RouterProvider[]
  strategy: string
  mode: string
}

let routerProcess: ReturnType<typeof execa> | null = null
let requestId = 0

async function getRouterPath(): Promise<string> {
  // Look for the Python router relative to the package root
  const paths = [
    join(process.cwd(), 'python', 'smart_router.py'),
    join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'python', 'smart_router.py'),
  ]

  const { readFile } = await import('fs/promises')
  for (const p of paths) {
    try {
      await readFile(p)
      return p
    } catch {
      continue
    }
  }
  throw new Error('Python smart router not found')
}

async function sendCommand(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
  const id = ++requestId
  const message = JSON.stringify({ jsonrpc: '2.0', id, method, params })

  if (!routerProcess) {
    const routerPath = await getRouterPath()
    routerProcess = execa('python3', [routerPath, '--jsonrpc'], {
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        ...process.env,
        ROUTER_MODE: process.env.ROUTER_MODE ?? 'smart',
        ROUTER_STRATEGY: process.env.ROUTER_STRATEGY ?? 'balanced',
        ROUTER_FALLBACK: process.env.ROUTER_FALLBACK ?? 'true',
      },
    })

    routerProcess.catch(() => {
      routerProcess = null
    })
  }

  routerProcess.stdin!.write(message + '\n')

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Router timeout')), 10_000)

    const onData = (chunk: Buffer) => {
      try {
        const response = JSON.parse(chunk.toString())
        if (response.id === id) {
          clearTimeout(timeout)
          routerProcess!.stdout!.off('data', onData)
          if (response.error) {
            reject(new Error(response.error.message))
          } else {
            resolve(response.result)
          }
        }
      } catch {
        // Incomplete JSON — wait for more data
      }
    }

    routerProcess!.stdout!.on('data', onData)
  })
}

export async function initializeRouter(): Promise<RouterHealth> {
  const result = await sendCommand('initialize') as RouterHealth
  return result
}

export async function routeRequest(
  messages: unknown[],
  model?: string,
  stream = false,
): Promise<RouteResult> {
  const result = await sendCommand('route', { messages, model, stream }) as RouteResult
  return result
}

export async function getRouterHealth(): Promise<RouterHealth> {
  const result = await sendCommand('health') as RouterHealth
  return result
}

export function shutdownRouter(): void {
  if (routerProcess) {
    routerProcess.kill()
    routerProcess = null
  }
}

/**
 * Check if smart routing is enabled via environment.
 */
export function isSmartRoutingEnabled(): boolean {
  return (process.env.ROUTER_MODE ?? 'fixed') === 'smart'
}
