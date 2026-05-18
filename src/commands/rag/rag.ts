import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.mjs'
import type { Command } from '../../commands.js'
import { getSuperAgentOrchestrator } from '../../services/superAgent/index.js'
import { getCwd } from '../../utils/cwd.js'

const command = {
  type: 'prompt',
  name: 'rag',
  description:
    'Manage RAG knowledge index — index project files, search semantically',
  isEnabled: () => true,
  progressMessage: 'managing RAG index',
  contentLength: 0,
  source: 'builtin',
  async getPromptForCommand(args?: string): Promise<ContentBlockParam[]> {
    const action = args?.trim() || 'help'
    const orchestrator = getSuperAgentOrchestrator()
    const ragStats = orchestrator.getState().ragStats

    if (action === 'help') {
      return [
        {
          type: 'text',
          text: `[RAG Knowledge System]

Usage:
- /rag index — Index the current project
- /rag search <query> — Semantic search
- /rag status — Show index status

Current Status: ${ragStats ? `${ragStats.documents} documents, ${ragStats.chunks} chunks indexed` : 'Not indexed yet'}

The RAG engine is integrated into the query loop — it automatically injects relevant context into the system prompt based on the user's query.`,
        },
      ]
    }

    if (action === 'index') {
      // Trigger actual indexing via the orchestrator
      const cwd = getCwd()
      const result = await orchestrator.indexDirectory(cwd)
      const docs = result?.documents ?? 0
      const chunks = result?.chunks ?? 0

      return [
        {
          type: 'text',
          text: `[RAG Indexing Complete]

Indexed: ${docs} documents, ${chunks} chunks from ${cwd}
Status: Active — context will be automatically injected into future queries based on semantic relevance.

The RAG engine uses TF-IDF embeddings (local, no API calls) for semantic search. Results are hybrid-scored using vector similarity + keyword matching.`,
        },
      ]
    }

    if (action.startsWith('search ')) {
      const query = action.slice(7).trim()
      // Run actual RAG search via the orchestrator
      const context = await orchestrator.getRAGContext(query)

      return [
        {
          type: 'text',
          text: `[RAG Semantic Search Results]

Query: ${query}

${context ?? 'No relevant results found. Try /rag index first to build the knowledge base.'}`,
        },
      ]
    }

    if (action === 'status') {
      return [
        {
          type: 'text',
          text: `[RAG Status]
${ragStats ? `Documents: ${ragStats.documents}
Chunks: ${ragStats.chunks}
Indexed dirs: ${ragStats.indexedDirs.join(', ')}` : 'Not indexed. Use /rag index to build the knowledge base.'}

The RAG engine is integrated into the super-agent orchestrator and automatically augments queries with semantically relevant context.`,
        },
      ]
    }

    return [
      { type: 'text', text: `[RAG] Unknown action. Use: index, search, status` },
    ]
  },
} satisfies Command

export default command
