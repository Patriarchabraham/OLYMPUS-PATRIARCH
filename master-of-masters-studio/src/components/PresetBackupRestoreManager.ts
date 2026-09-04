/**
 * Master of Masters Studio Pro — Preset JSON Backup & Restore Manager.
 *
 * Allows users to export all custom artist presets, EQ balances, and rig settings
 * to a portable .json file and import them back on any computer with 1 click.
 */

import { PresetManager } from './PresetManager'

export class PresetBackupRestoreManager {
	/**
	 * Exports all saved user presets into a downloadable JSON file.
	 */
	public static exportPresetsToJson(): Blob {
		const presets = PresetManager.getPresets()
		const jsonStr = JSON.stringify(
			{
				schema: 'master-of-masters-presets-v1',
				exportDate: new Date().toISOString(),
				presetsCount: presets.length,
				presets,
			},
			null,
			2,
		)
		return new Blob([jsonStr], { type: 'application/json' })
	}

	/**
	 * Imports and validates presets from a JSON file.
	 */
	public static async importPresetsFromJson(
		file: File,
	): Promise<{ success: boolean; importedCount: number; message: string }> {
		try {
			const text = await file.text()
			const data = JSON.parse(text)

			if (!data.presets || !Array.isArray(data.presets)) {
				return {
					success: false,
					importedCount: 0,
					message: 'Arquivo JSON inválido ou sem presets.',
				}
			}

			let count = 0
			for (const p of data.presets) {
				if (p.name && p.producerId && p.albumId) {
					PresetManager.savePreset({
						name: p.name,
						producerId: p.producerId,
						albumId: p.albumId,
						satDrive: p.satDrive ?? 0.5,
						stereoWidth: p.stereoWidth ?? 1.0,
						intensity: p.intensity ?? 0.75,
					})
					count++
				}
			}

			return {
				success: true,
				importedCount: count,
				message: `${count} presets restaurados com sucesso!`,
			}
		} catch (err: any) {
			return {
				success: false,
				importedCount: 0,
				message: `Erro ao importar arquivo: ${err.message || String(err)}`,
			}
		}
	}
}
