import type { ToolUseContext } from '../Tool.js'
import type { Command } from '../types/command.js'
import {
  benchmarkModel,
  benchmarkMultipleModels,
  formatBenchmarkResults,
  isBenchmarkSupported,
} from '../utils/model/benchmark.js'
import { getCachedOllamaModelOptions } from '../utils/model/ollamaModels.js'

async function runBenchmark(
  model?: string,
  context?: ToolUseContext,
): Promise<void> {
  if (!isBenchmarkSupported()) {
    return
  }

  let modelsToBenchmark: string[]

  if (model) {
    modelsToBenchmark = [model]
  } else {
    const ollamaModels = getCachedOllamaModelOptions()
    modelsToBenchmark = ollamaModels.slice(0, 3).map((m) => m.value)
  }

  const results = await benchmarkMultipleModels(
    modelsToBenchmark,
    (completed, total, result) => {
      void completed
      void total
      void result
    },
  )

  void results
}

export const benchmark: Command = {
  type: 'prompt',
  name: 'benchmark',
  description: 'Benchmark models',
  progressMessage: 'Running benchmark...',
  contentLength: 0,
  source: 'builtin',
  async getPromptForCommand(args: string) {
    await runBenchmark(args || undefined)
    return [{ type: 'text', text: 'Benchmark complete.' }]
  },
}
