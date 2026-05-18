import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.mjs'
import type { Command } from '../../commands.js'
import { research } from '../../webintel/deepResearch.js'
import type { ResearchSource, SearchFn, FetchFn } from '../../webintel/types.js'
import { runSearch } from '../../tools/WebSearchTool/providers/index.js'
import { getURLMarkdownContent } from '../../tools/WebFetchTool/utils.js'

/**
 * SearchFn implementation that delegates to the WebSearchTool provider chain.
 * Converts SearchHit results into ResearchSource objects expected by the
 * deep research pipeline.
 */
const webSearchFn: SearchFn = async (query: string): Promise<ResearchSource[]> => {
  const controller = new AbortController()
  try {
    const output = await runSearch(
      { query },
      controller.signal,
    )

    return output.hits.map(hit => ({
      url: hit.url,
      title: hit.title,
      snippet: hit.description ?? '',
      relevanceScore: 0.5, // baseline; deep research re-scores via evaluateSource
      credibilityScore: 0,
    }))
  } catch {
    return []
  }
}

/**
 * FetchFn implementation that delegates to WebFetchTool's URL fetching.
 * Returns raw markdown content from the URL.
 */
const webFetchFn: FetchFn = async (url: string): Promise<string> => {
  const controller = new AbortController()
  try {
    const result = await getURLMarkdownContent(url, controller)
    // getURLMarkdownContent can return a RedirectInfo — skip those
    if ('type' in result && result.type === 'redirect') {
      return ''
    }
    return result.content
  } catch {
    return ''
  }
}

const command = {
  type: 'prompt',
  name: 'research',
  description:
    'Deep web research — multi-source search, synthesis, and fact-checking',
  isEnabled: () => true,
  progressMessage: 'conducting deep research',
  contentLength: 0,
  source: 'builtin',
  async getPromptForCommand(args?: string): Promise<ContentBlockParam[]> {
    const topic = args?.trim()

    if (!topic) {
      return [
        {
          type: 'text',
          text: '[Research] Usage: /research <topic>\n\nConducts deep multi-source research with:\n- Multiple search queries\n- Source credibility assessment\n- Cross-reference fact-checking\n- Synthesized findings',
        },
      ]
    }

    // Execute the deep research pipeline with real search/fetch backends
    try {
      const result = await research(topic, 2, {
        searchFn: webSearchFn,
        fetchFn: webFetchFn,
      })

      const sourceList = result.sources
        .slice(0, 10)
        .map(s => `- **${s.title}** (${s.url}) — credibility: ${(s.credibilityScore * 100).toFixed(0)}%`)
        .join('\n')

      const findings = result.keyFindings.length > 0
        ? result.keyFindings.map((f, i) => `${i + 1}. ${f}`).join('\n')
        : 'No key findings extracted.'

      const contradictions = result.contradictions.length > 0
        ? '\n## Contradictions\n' + result.contradictions.map(c => `- ${c}`).join('\n')
        : ''

      return [
        {
          type: 'text',
          text: `${result.synthesis}

## Key Findings
${findings}

## Sources (${result.sources.length} found, confidence: ${(result.confidence * 100).toFixed(0)}%)
${sourceList}
${contradictions}

Research completed in ${result.durationMs}ms.`,
        },
      ]
    } catch (err) {
      // Fallback: if the pipeline fails, instruct the model to do it manually
      return [
        {
          type: 'text',
          text: `[Deep Research Mode — Pipeline fallback]

Topic: ${topic}

The automated research pipeline encountered an error (${err instanceof Error ? err.message : String(err)}).

Please research this topic manually using:
1. Generate multiple search queries from different angles
2. Search using WebSearchTool with varied queries
3. Fetch top results using WebFetchTool
4. Assess source credibility
5. Cross-reference findings across sources
6. Synthesize a comprehensive answer

Begin researching: ${topic}`,
        },
      ]
    }
  },
} satisfies Command

export default command
