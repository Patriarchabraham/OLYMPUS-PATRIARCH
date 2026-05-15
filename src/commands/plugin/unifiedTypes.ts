import type { MCPServerConnection } from '../../services/mcp/types.js';
import type { LoadedPlugin, PluginError } from '../../types/plugin.js';

export type UnifiedInstalledItem =
  | (UnifiedPluginItem & { type: 'plugin' })
  | (UnifiedMcpItem & { type: 'mcp' })
  | (UnifiedFailedPluginItem & { type: 'failed-plugin' })
  | (UnifiedFlaggedPluginItem & { type: 'flagged-plugin' });

export type UnifiedPluginItem = {
  id: string;
  name: string;
  description?: string;
  marketplace: string;
  scope: string;
  isEnabled: boolean;
  errorCount: number;
  errors: PluginError[];
  plugin: LoadedPlugin;
  pendingEnable?: boolean;
  pendingUpdate?: boolean;
  pendingToggle?: 'will-enable' | 'will-disable';
};

export type UnifiedMcpItem = {
  id: string;
  name: string;
  description?: string;
  scope: string;
  status: 'connected' | 'disabled' | 'pending' | 'needs-auth' | 'failed';
  client: MCPServerConnection;
  indented?: boolean;
};

export type UnifiedFailedPluginItem = {
  id: string;
  name: string;
  marketplace: string;
  scope: string;
  errorCount: number;
  errors: PluginError[];
};

export type UnifiedFlaggedPluginItem = {
  id: string;
  name: string;
  marketplace: string;
  scope: string;
  reason: string;
  text: string;
  flaggedAt: string;
};
