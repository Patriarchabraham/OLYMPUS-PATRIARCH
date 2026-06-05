import { randomUUID } from 'crypto'
import type { MonitorTarget, MonitorResult } from './types.js'

/**
 * Data monitor for watching URLs and endpoints for changes.
 * Uses Node.js built-in http/https for fetching.
 */
export class DataMonitor {
  private targets: Map<string, MonitorTarget> = new Map()
  private timers: Map<string, ReturnType<typeof setInterval>> = new Map()
  private running = false

  /**
   * Add a target to monitor.
   */
  addTarget(target: Omit<MonitorTarget, 'id' | 'lastChecked' | 'lastValue' | 'active'> & { id?: string }): MonitorTarget {
    const fullTarget: MonitorTarget = {
      id: target.id ?? randomUUID(),
      url: target.url,
      type: target.type,
      intervalMs: target.intervalMs,
      active: true,
    }
    this.targets.set(fullTarget.id, fullTarget)
    return fullTarget
  }

  /**
   * Remove a monitored target.
   */
  removeTarget(targetId: string): boolean {
    const timer = this.timers.get(targetId)
    if (timer) {
      clearInterval(timer)
      this.timers.delete(targetId)
    }
    return this.targets.delete(targetId)
  }

  /**
   * Start monitoring all active targets.
   */
  startMonitoring(): void {
    if (this.running) return
    this.running = true

    for (const target of this.targets.values()) {
      if (target.active) {
        this.scheduleTarget(target)
      }
    }
  }

  /**
   * Stop all monitoring.
   */
  stopMonitoring(): void {
    this.running = false
    for (const timer of this.timers.values()) {
      clearInterval(timer)
    }
    this.timers.clear()
  }

  /**
   * Check a single target for changes.
   */
  async checkTarget(target: MonitorTarget): Promise<MonitorResult> {
    const currentValue = await this.fetchTarget(target)
    const target_ = this.targets.get(target.id)
    const previousValue = target_?.lastValue ?? target.lastValue

    const changed = previousValue != null
      ? this.detectChanges(previousValue, currentValue)
      : false

    // Update stored target state
    if (target_) {
      target_.lastChecked = Date.now()
      target_.lastValue = currentValue
    }

    // Fire change callback if registered
    if (changed && target_?.changeCallback && previousValue != null) {
      try {
        target_.changeCallback(currentValue, previousValue)
      } catch {
        // Swallow callback errors
      }
    }

    return {
      targetId: target.id,
      changed,
      currentValue,
      previousValue,
      timestamp: Date.now(),
    }
  }

  /**
   * Detect if content has changed between two values.
   * Normalizes whitespace for comparison.
   */
  detectChanges(oldValue: string, newValue: string): boolean {
    const normalize = (s: string) => s.replace(/\s+/g, ' ').trim()
    return normalize(oldValue) !== normalize(newValue)
  }

  /**
   * Get all monitored targets.
   */
  getTargets(): MonitorTarget[] {
    return [...this.targets.values()]
  }

  /**
   * Get a specific target.
   */
  getTarget(targetId: string): MonitorTarget | undefined {
    return this.targets.get(targetId)
  }

  /**
   * Check if monitoring is active.
   */
  isRunning(): boolean {
    return this.running
  }

  private scheduleTarget(target: MonitorTarget): void {
    // Initial check
    this.checkTarget(target).catch(() => {})

    const timer = setInterval(async () => {
      try {
        await this.checkTarget(target)
      } catch {
        // Continue monitoring on error
      }
    }, target.intervalMs)

    this.timers.set(target.id, timer)
  }

  private async fetchTarget(target: MonitorTarget): Promise<string> {
    const url = new URL(target.url)
    const isHttps = url.protocol === 'https:'
    const httpModule = isHttps ? await import('https') : await import('http')

    return new Promise<string>((resolve, reject) => {
      const options: Record<string, unknown> = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Olympuz-WebIntel/1.0',
          'Accept': target.type === 'json-endpoint' ? 'application/json' : '*/*',
        },
        timeout: 10000,
      }

      const req = httpModule.request(options, (res: { on: (event: string, cb: (chunk?: Buffer) => void) => void; statusCode?: number }) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk?: Buffer) => { if (chunk) chunks.push(chunk) })
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf-8')

          if (target.type === 'json-endpoint') {
            try {
              const json = JSON.parse(body)
              resolve(JSON.stringify(json, null, 2))
            } catch {
              resolve(body)
            }
          } else {
            resolve(body)
          }
        })
      })

      req.on('error', (err: Error) => reject(err))
      req.on('timeout', () => {
        req.destroy()
        reject(new Error(`Request timeout for ${target.url}`))
      })

      req.end()
    })
  }
}
