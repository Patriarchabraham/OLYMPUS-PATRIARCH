import type { APIEndpoint, APIOrchestrationResult, RateLimitEntry } from './types.js'

/**
 * API orchestrator for making coordinated HTTP requests
 * with rate limiting, retries, and sequential/parallel/chained modes.
 */
export class APIOrchestrator {
  private rateLimits: Map<string, RateLimitEntry> = new Map()
  private defaultTimeout = 30000
  private defaultRetries = 3
  private defaultRetryDelayMs = 1000

  /**
   * Call a single API endpoint.
   */
  async callEndpoint(endpoint: APIEndpoint): Promise<APIOrchestrationResult> {
    const startTime = Date.now()

    await this.enforceRateLimit(endpoint)

    try {
      const data = await this.callWithRetry(endpoint)
      return {
        endpoint: endpoint.name,
        success: true,
        data: this.extractResponsePath(data, endpoint.responsePath),
        durationMs: Date.now() - startTime,
      }
    } catch (error) {
      return {
        endpoint: endpoint.name,
        success: false,
        data: null,
        durationMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  /**
   * Orchestrate multiple API calls in the specified mode.
   *
   * - sequential: calls one after another
   * - parallel: calls all at once
   * - chained: passes output of each call as input to the next
   */
  async orchestrate(
    endpoints: APIEndpoint[],
    mode: 'sequential' | 'parallel' | 'chained',
  ): Promise<APIOrchestrationResult[]> {
    switch (mode) {
      case 'sequential':
        return this.orchestrateSequential(endpoints)
      case 'parallel':
        return this.orchestrateParallel(endpoints)
      case 'chained':
        return this.orchestrateChained(endpoints)
    }
  }

  /**
   * Chain API calls, passing output from each to the next.
   */
  async chainCalls(
    endpoints: APIEndpoint[],
    dataTransformer?: (data: unknown) => unknown,
  ): Promise<APIOrchestrationResult[]> {
    return this.orchestrateChained(endpoints, dataTransformer)
  }

  /**
   * Set rate limit for an endpoint.
   */
  rateLimit(endpoint: APIEndpoint, requestsPerSecond: number): void {
    this.rateLimits.set(endpoint.baseUrl, {
      endpoint: endpoint.baseUrl,
      requestsPerSecond,
      lastRequestTime: 0,
      requestCount: 0,
    })
  }

  /**
   * Set default timeout for all requests.
   */
  setDefaultTimeout(timeoutMs: number): void {
    this.defaultTimeout = timeoutMs
  }

  /**
   * Set default retry count.
   */
  setDefaultRetries(retries: number): void {
    this.defaultRetries = retries
  }

  // --- Private methods ---

  private async orchestrateSequential(endpoints: APIEndpoint[]): Promise<APIOrchestrationResult[]> {
    const results: APIOrchestrationResult[] = []
    for (const endpoint of endpoints) {
      results.push(await this.callEndpoint(endpoint))
    }
    return results
  }

  private async orchestrateParallel(endpoints: APIEndpoint[]): Promise<APIOrchestrationResult[]> {
    return Promise.all(endpoints.map(ep => this.callEndpoint(ep)))
  }

  private async orchestrateChained(
    endpoints: APIEndpoint[],
    dataTransformer?: (data: unknown) => unknown,
  ): Promise<APIOrchestrationResult[]> {
    const results: APIOrchestrationResult[] = []
    let previousData: unknown = null

    for (const endpoint of endpoints) {
      // Inject previous data into the current request body if not set
      const enrichedEndpoint: APIEndpoint = {
        ...endpoint,
        body: endpoint.body ?? (previousData != null ? previousData : undefined),
      }

      const result = await this.callEndpoint(enrichedEndpoint)

      if (dataTransformer && result.success) {
        result.data = dataTransformer(result.data)
      }

      results.push(result)
      previousData = result.success ? result.data : null

      // Stop chain on failure
      if (!result.success) break
    }

    return results
  }

  private async callWithRetry(endpoint: APIEndpoint, retries?: number): Promise<unknown> {
    const maxRetries = retries ?? this.defaultRetries
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.makeRequest(endpoint)
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        // Don't retry on client errors (4xx)
        if (this.isClientError(lastError)) {
          throw lastError
        }

        // Exponential backoff
        if (attempt < maxRetries) {
          const delay = this.defaultRetryDelayMs * Math.pow(2, attempt)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    throw lastError ?? new Error('Request failed after retries')
  }

  private async makeRequest(endpoint: APIEndpoint): Promise<unknown> {
    const url = new URL(endpoint.baseUrl)
    const isHttps = url.protocol === 'https:'
    const httpModule = isHttps ? await import('https') : await import('http')

    return new Promise<unknown>((resolve, reject) => {
      const bodyData = endpoint.body != null
        ? JSON.stringify(endpoint.body)
        : undefined

      const options: Record<string, unknown> = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: endpoint.method,
        headers: {
          'User-Agent': 'Mythos-WebIntel/1.0',
          'Accept': 'application/json',
          ...(bodyData != null
            ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyData) }
            : {}),
          ...endpoint.headers,
        },
        timeout: this.defaultTimeout,
      }

      const req = httpModule.request(options, (res: {
        on: (event: string, cb: (chunk?: Buffer) => void) => void
        statusCode?: number
      }) => {
        const chunks: Buffer[] = []

        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf-8')
          const statusCode = res.statusCode ?? 0

          if (statusCode >= 400) {
            const error = new Error(`HTTP ${statusCode}: ${body.slice(0, 200)}`)
            error.name = `HTTP_${statusCode}`
            reject(error)
            return
          }

          // Try to parse JSON
          try {
            resolve(JSON.parse(body))
          } catch {
            resolve(body)
          }
        })
      })

      req.on('error', (err: Error) => reject(err))
      req.on('timeout', () => {
        req.destroy()
        reject(new Error(`Request timeout: ${endpoint.baseUrl}`))
      })

      if (bodyData != null) {
        req.write(bodyData)
      }
      req.end()
    })
  }

  private extractResponsePath(data: unknown, path?: string): unknown {
    if (!path || data == null || typeof data !== 'object') return data

    const segments = path.split('.').filter(Boolean)
    let current: unknown = data

    for (const segment of segments) {
      if (current == null || typeof current !== 'object') return null
      current = (current as Record<string, unknown>)[segment]
    }

    return current
  }

  private async enforceRateLimit(endpoint: APIEndpoint): Promise<void> {
    const entry = this.rateLimits.get(endpoint.baseUrl)
    if (!entry) return

    const minInterval = 1000 / entry.requestsPerSecond
    const elapsed = Date.now() - entry.lastRequestTime
    const waitTime = minInterval - elapsed

    if (waitTime > 0) {
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }

    entry.lastRequestTime = Date.now()
    entry.requestCount++
  }

  private isClientError(error: Error): boolean {
    return error.name.startsWith('HTTP_4')
  }
}
