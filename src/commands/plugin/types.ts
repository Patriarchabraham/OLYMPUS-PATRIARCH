import type { PluginError } from '../../types/plugin.js';

export type ViewState =
  | { type: 'menu' }
  | { type: 'help' }
  | { type: 'validate'; path: string }
  | { type: 'discover-plugins'; targetPlugin?: string }
  | { type: 'browse-marketplace'; targetMarketplace: string; targetPlugin?: string }
  | { type: 'manage-plugins'; targetPlugin?: string; targetMarketplace?: string; action?: 'enable' | 'disable' | 'uninstall' }
  | { type: 'manage-marketplaces'; targetMarketplace?: string; action?: 'update' | 'remove' }
  | { type: 'add-marketplace'; initialValue?: string }
  | { type: 'marketplace-menu' }
  | { type: 'marketplace-list' };

export type PluginSettingsProps = {
  onComplete: (result?: string) => void;
  args: string;
  showMcpRedirectMessage?: boolean;
};
