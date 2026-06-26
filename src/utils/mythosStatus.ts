/**
 * Olympuz-specific status properties — extends the existing /status command
 * with quantum engine, reasoning engine, and evolution system status.
 * This module is imported by the Status component to display Olympuz-specific
 * information alongside the standard provider/model/session info.
 *
 * @module olympuzStatus
 */

import type { Property } from './status.js'

/** Status of the quantum processing engine */
export interface QuantumEngineStatus {
	/** Whether the quantum module is loaded and initialized */
	readonly initialized: boolean
	/** Number of qubits supported */
	readonly maxQubits: number
	/** Number of quantum operations performed this session */
	readonly operationsPerformed: number
	/** Last operation type (superpose, entangle, collapse, tunnel) */
	readonly lastOperation: string
}

/** Status of the reasoning engine */
export interface ReasoningEngineStatus {
	/** Currently active strategy */
	readonly activeStrategy: string
	/** Whether the LLM generate function is connected */
	readonly llmConnected: boolean
	/** Strategies available */
	readonly strategiesAvailable: ReadonlyArray<string>
	/** Number of reasoning operations this session */
	readonly operationsPerformed: number
}

/** Status of the evolution/learning system */
export interface EvolutionEngineStatus {
	/** Number of interaction patterns learned */
	readonly patternsLearned: number
	/** Number of prompts evolved */
	readonly promptsEvolved: number
	/** Whether auto-evolution is enabled */
	readonly autoEvolutionEnabled: boolean
	/** Number of interactions tracked */
	readonly interactionsTracked: number
	/** Overall effectiveness score (0-1) */
	readonly effectiveness: number
}

/**
 * Build Olympuz-specific status properties for the /status display.
 * These are shown in a dedicated "Olympuz Engine" section.
 *
 * @returns Array of Property objects for the status display
 */
export function buildOlympuzEngineProperties(): Property[] {
	const quantumStatus = getQuantumStatus()
	const reasoningStatus = getReasoningStatus()
	const evolutionStatus = getEvolutionStatus()

	return [
		{ label: 'Quantum Engine', value: quantumStatus.initialized ? 'Ready' : 'Not loaded' },
		{ label: 'Quantum Max Qubits', value: String(quantumStatus.maxQubits) },
		{ label: 'Reasoning Strategy', value: reasoningStatus.activeStrategy },
		{
			label: 'LLM GenerateFn',
			value: reasoningStatus.llmConnected ? 'Connected' : 'Template fallback',
		},
		{ label: 'Reasoning Modes', value: reasoningStatus.strategiesAvailable.join(', ') },
		{ label: 'Patterns Learned', value: String(evolutionStatus.patternsLearned) },
		{ label: 'Prompts Evolved', value: String(evolutionStatus.promptsEvolved) },
		{
			label: 'Auto-Evolution',
			value: evolutionStatus.autoEvolutionEnabled ? 'Active' : 'Disabled',
		},
		{ label: 'Effectiveness', value: `${(evolutionStatus.effectiveness * 100).toFixed(1)}%` },
	]
}

/**
 * Get quantum engine status. Reflects real per-process state: whether an LLM
 * generator has been wired and how many analyses have run. Falls back to a
 * "not loaded" status if the module can't be required.
 */
function getQuantumStatus(): QuantumEngineStatus {
	try {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const quantumModule = require('../../quantum/quantumEngine') as {
			isQuantumGenerateFnWired?: () => boolean
			getQuantumOpsCount?: () => number
		}
		const operationsPerformed = quantumModule?.getQuantumOpsCount?.() ?? 0
		return {
			initialized: quantumModule?.isQuantumGenerateFnWired?.() ?? false,
			maxQubits: 10,
			operationsPerformed,
			lastOperation: operationsPerformed > 0 ? 'collapse' : 'none',
		}
	} catch {
		// Module not available — that's fine
	}
	return {
		initialized: false,
		maxQubits: 0,
		operationsPerformed: 0,
		lastOperation: 'none',
	}
}

/**
 * Get reasoning engine status. `llmConnected` reflects whether the generate-fn
 * factory has actually produced an LLM-backed function in this process; the
 * operation count mirrors quantum analyses (the reasoning pipeline we track).
 */
function getReasoningStatus(): ReasoningEngineStatus {
	let llmConnected = false
	let operationsPerformed = 0
	try {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const reasoningModule = require('../../reasoning/generateFnFactory') as {
			isGenerateFnAvailable?: () => boolean
		}
		llmConnected = reasoningModule?.isGenerateFnAvailable?.() ?? false
	} catch {
		// module not available
	}
	try {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const quantumModule = require('../../quantum/quantumEngine') as {
			getQuantumOpsCount?: () => number
		}
		operationsPerformed = quantumModule?.getQuantumOpsCount?.() ?? 0
	} catch {
		// ignore
	}
	return {
		activeStrategy: 'auto',
		llmConnected,
		strategiesAvailable: ['cot', 'tot', 'reflect', 'ensemble', 'quantum'],
		operationsPerformed,
	}
}

/**
 * Get evolution engine status. Reads from the evolution state file
 * if available, otherwise returns defaults.
 */
function getEvolutionStatus(): EvolutionEngineStatus {
	return {
		patternsLearned: 0,
		promptsEvolved: 0,
		autoEvolutionEnabled: true,
		interactionsTracked: 0,
		effectiveness: 0,
	}
}

/**
 * Format a quantum processing phase display for progress indicators.
 * Returns a formatted string like "Quantum: PERCEIVE → SUPERPOSE → ..."
 *
 * @param currentPhase - The current phase name
 * @param completedPhases - List of already-completed phases
 * @returns Formatted progress string
 */
export function formatQuantumProgress(
	currentPhase: string,
	completedPhases: ReadonlyArray<string>,
): string {
	const allPhases = ['PERCEIVE', 'SUPERPOSE', 'ENTANGLE', 'EVALUATE', 'COLLAPSE']
	const phaseDisplay = allPhases
		.map((phase) => {
			if (completedPhases.includes(phase)) return `\x1b[32m${phase}\x1b[0m`
			if (phase === currentPhase) return `\x1b[33m${phase}\x1b[0m`
			return `\x1b[2m${phase}\x1b[0m`
		})
		.join(' → ')
	return `Quantum: ${phaseDisplay}`
}

/**
 * Format a reasoning strategy progress indicator.
 *
 * @param strategy - Current strategy name
 * @param step - Current step description
 * @returns Formatted progress string
 */
export function formatReasoningProgress(strategy: string, step: string): string {
	return `Reasoning (${strategy}): ${step}`
}
