/**
 * Master of Masters Studio Pro — User Custom Preset Snapshot Manager.
 * Allows saving, loading, and deleting custom user mastering chains in LocalStorage.
 */

export interface CustomPreset {
  id: string;
  name: string;
  producerId: string;
  albumId: string;
  satDrive: number;
  stereoWidth: number;
  intensity: number;
  timestamp: number;
}

export class PresetManager {
  private static STORAGE_KEY = 'moms_user_presets_v1';

  public static getPresets(): CustomPreset[] {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  public static savePreset(preset: Omit<CustomPreset, 'id' | 'timestamp'>): CustomPreset {
    const presets = this.getPresets();
    const newPreset: CustomPreset = {
      ...preset,
      id: 'preset_' + Date.now(),
      timestamp: Date.now(),
    };
    presets.push(newPreset);
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(presets));
    } catch (e) {
      console.error('[PresetManager] Failed to save preset:', e);
    }
    return newPreset;
  }

  public static deletePreset(id: string): void {
    const presets = this.getPresets().filter((p) => p.id !== id);
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(presets));
    } catch (e) {
      console.error('[PresetManager] Failed to delete preset:', e);
    }
  }
}
