import type { MCPServerConnection, ConfigScope } from '../../services/mcp/types.js'
import type {
  McpStdioServerConfig,
  McpSSEServerConfig,
  McpHTTPServerConfig,
  McpClaudeAIProxyServerConfig,
} from '../../services/mcp/types.js'

export type StdioServerInfo = {
  name: string
  client: MCPServerConnection
  scope: string
  transport: 'stdio'
  config: McpStdioServerConfig
}

export type SSEServerInfo = {
  name: string
  client: MCPServerConnection
  scope: string
  transport: 'sse'
  isAuthenticated?: boolean
  config: McpSSEServerConfig
}

export type HTTPServerInfo = {
  name: string
  client: MCPServerConnection
  scope: string
  transport: 'http'
  isAuthenticated?: boolean
  config: McpHTTPServerConfig
}

export type ClaudeAIServerInfo = {
  name: string
  client: MCPServerConnection
  scope: string
  transport: 'claudeai-proxy'
  isAuthenticated?: boolean
  config: McpClaudeAIProxyServerConfig
}

export type ServerInfo = StdioServerInfo | SSEServerInfo | HTTPServerInfo | ClaudeAIServerInfo

export type AgentMcpServerInfo = {
  name: string
  sourceAgents: Array<{ name: string }>
  transport: 'stdio' | 'sse' | 'http' | 'ws'
  command?: string
  url?: string
  needsAuth: boolean
}

export type MCPViewState =
  | { type: 'list'; defaultTab?: string }
  | { type: 'server'; server: ServerInfo }
  | { type: 'tools'; server: ServerInfo }
  | { type: 'tool'; server: ServerInfo; toolIndex: number }
  | { type: 'agent-server'; agentServer: AgentMcpServerInfo }
