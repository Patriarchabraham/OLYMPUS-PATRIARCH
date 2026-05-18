import { mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import type { ToolPipeline } from './types.js'

const DEFAULT_DIR = '.openclaude/compositions'

export class ToolRegistry {
  private pipelines: Map<string, ToolPipeline> = new Map()
  private dataDir: string

  constructor(dataDir?: string) {
    this.dataDir = dataDir ?? DEFAULT_DIR
  }

  registerPipeline(pipeline: ToolPipeline): void {
    this.pipelines.set(pipeline.id, { ...pipeline })
  }

  getPipeline(id: string): ToolPipeline | undefined {
    return this.pipelines.get(id)
  }

  listPipelines(filter?: {
    tags?: string[]
    category?: string
  }): ToolPipeline[] {
    let results = Array.from(this.pipelines.values())

    if (filter?.tags && filter.tags.length > 0) {
      results = results.filter((p) =>
        filter.tags!.some((tag) => p.tags.includes(tag)),
      )
    }

    if (filter?.category) {
      results = results.filter((p) => p.tags.includes(filter.category!))
    }

    return results
  }

  removePipeline(id: string): void {
    this.pipelines.delete(id)
  }

  updateStats(pipelineId: string, success: boolean): void {
    const pipeline = this.pipelines.get(pipelineId)
    if (!pipeline) return

    const totalExecutions = pipeline.executionCount + 1
    const totalSuccesses = Math.round(
      pipeline.successRate * pipeline.executionCount,
    )
    const newSuccesses = totalSuccesses + (success ? 1 : 0)

    pipeline.executionCount = totalExecutions
    pipeline.successRate = totalExecutions > 0 ? newSuccesses / totalExecutions : 1
    pipeline.updatedAt = Date.now()
  }

  async save(): Promise<void> {
    try {
      await mkdir(this.dataDir, { recursive: true })
      const data = Array.from(this.pipelines.values())
      const filePath = join(this.dataDir, 'pipelines.json')
      await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
    } catch {
      // Silently fail if not persistable
    }
  }

  async load(): Promise<void> {
    try {
      const filePath = join(this.dataDir, 'pipelines.json')
      const raw = await readFile(filePath, 'utf-8')
      const data: ToolPipeline[] = JSON.parse(raw)
      this.pipelines.clear()
      for (const pipeline of data) {
        this.pipelines.set(pipeline.id, pipeline)
      }
    } catch {
      // File doesn't exist or invalid — start empty
    }
  }

  size(): number {
    return this.pipelines.size
  }

  clear(): void {
    this.pipelines.clear()
  }
}
