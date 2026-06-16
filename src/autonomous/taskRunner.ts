import {
	clearGoalCheckpoints,
	createCheckpoint,
	loadCheckpoint,
	saveCheckpoint,
} from './checkpoint.js'
import {
	analyzeError,
	attemptRecovery,
	createErrorContext,
	escalateToUser,
} from './errorRecovery.js'
import {
	completeGoal,
	decomposeGoal,
	failGoal,
	getGoal,
	recalculateProgress,
	updateGoal,
} from './goalManager.js'
import {
	type getProgress,
	setStatus,
	startTracking,
	stopTracking,
	updateProgress,
} from './progressTracker.js'
import type { AutonomousConfig, AutonomousGoal, Milestone } from './types.js'
import { DEFAULT_CONFIG } from './types.js'

export type StepExecutor = (
	step: string,
	context: Record<string, unknown>,
) => Promise<Record<string, unknown>>

export interface TaskRunnerCallbacks {
	onMilestoneStart?: (goalId: string, milestone: Milestone) => void
	onMilestoneComplete?: (goalId: string, milestone: Milestone) => void
	onMilestoneFailed?: (goalId: string, milestone: Milestone, error: Error) => void
	onProgress?: (goalId: string, progress: ReturnType<typeof getProgress>) => void
	onCheckpoint?: (goalId: string, checkpointId: string) => void
	onRecovery?: (goalId: string, strategy: string, attempt: number) => void
	onEscalation?: (goalId: string, message: string) => string
	executeStep?: StepExecutor
}

export async function executeGoal(
	goal: AutonomousGoal,
	config: AutonomousConfig = DEFAULT_CONFIG,
	callbacks?: TaskRunnerCallbacks,
): Promise<void> {
	const goalId = goal.id

	// Decompose goal into milestones if not already done
	if (goal.milestones.length === 0) {
		decomposeGoal(goal)
	}

	// Check for existing checkpoint to resume from
	const existingCheckpoint = await loadCheckpoint(goalId)
	let startMilestoneIndex = 0
	if (existingCheckpoint) {
		startMilestoneIndex = goal.milestones.findIndex((m) => m.id === existingCheckpoint.milestoneId)
		if (startMilestoneIndex >= 0) startMilestoneIndex++
		else startMilestoneIndex = 0
	}

	// Update goal status
	updateGoal(goalId, { status: 'in_progress' })

	// Start progress tracking
	startTracking(goalId, goal.milestones.length)

	try {
		for (let i = startMilestoneIndex; i < goal.milestones.length; i++) {
			const milestone = goal.milestones[i]!
			if (milestone.status === 'completed') continue

			callbacks?.onMilestoneStart?.(goalId, milestone)

			try {
				await executeMilestone(milestone, config, callbacks, goalId)

				milestone.status = 'completed'
				milestone.result = 'Completed successfully'
				callbacks?.onMilestoneComplete?.(goalId, milestone)

				// Update progress
				const progress = updateProgress(goalId, milestone.title)
				callbacks?.onProgress?.(goalId, progress)
				recalculateProgress(goalId)

				// Create checkpoint after each milestone
				const cp = createCheckpoint(goalId, milestone.id, i, { milestoneStatus: 'completed' })
				await saveCheckpoint(cp)
				callbacks?.onCheckpoint?.(goalId, cp.id)
			} catch (error) {
				const err = error instanceof Error ? error : new Error(String(error))
				milestone.status = 'failed'
				callbacks?.onMilestoneFailed?.(goalId, milestone, err)

				if (config.autoRecovery) {
					const handled = await handleMilestoneError(goalId, milestone, err, config, callbacks)
					if (!handled) {
						setStatus(goalId, 'failed')
						failGoal(goalId, err.message)
						throw err
					}
				} else {
					setStatus(goalId, 'failed')
					failGoal(goalId, err.message)
					throw err
				}
			}
		}

		completeGoal(goalId, 'All milestones completed')
		setStatus(goalId, 'completed')
		await clearGoalCheckpoints(goalId)
	} catch (error) {
		setStatus(goalId, 'failed')
		throw error
	} finally {
		stopTracking(goalId)
	}
}

export async function executeMilestone(
	milestone: Milestone,
	_config: AutonomousConfig,
	callbacks?: TaskRunnerCallbacks,
	goalId?: string,
): Promise<void> {
	milestone.status = 'in_progress'

	// If a custom step executor is provided, use it
	if (callbacks?.executeStep && goalId) {
		const state: Record<string, unknown> = {}
		// Execute the milestone as a single step using the custom executor
		const result = await callbacks.executeStep(milestone.description, state)
		milestone.result = JSON.stringify(result)
	} else {
		// No step executor wired — record an honest sentinel instead of a fake
		// 'Executed' result. SuperAgent always provides an executeStep callback, so
		// this branch is only reachable by callers that build a runner without one.
		milestone.result = 'Skipped: no step executor wired'
	}
}

async function handleMilestoneError(
	goalId: string,
	milestone: Milestone,
	error: Error,
	config: AutonomousConfig,
	callbacks?: TaskRunnerCallbacks,
): Promise<boolean> {
	let errorContext = createErrorContext(error, milestone.title, goalId, milestone.id)

	for (let attempt = 0; attempt < config.maxRecoveryAttempts; attempt++) {
		const strategy = analyzeError(error, errorContext)
		callbacks?.onRecovery?.(goalId, strategy.type, attempt + 1)

		if (strategy.type === 'escalate') {
			const message = escalateToUser(error, errorContext)
			if (callbacks?.onEscalation) {
				const userResponse = callbacks.onEscalation(goalId, message)
				if (userResponse) {
					// User provided guidance, try once more
					try {
						if (callbacks.executeStep) {
							await callbacks.executeStep(milestone.description, {})
						}
						return true
					} catch {
						return false
					}
				}
			}
			return false
		}

		if (strategy.type === 'skip') {
			milestone.result = `Skipped after error: ${error.message}`
			milestone.status = 'completed' // Mark as completed to continue
			return true
		}

		// Try recovery
		const recovered = await attemptRecovery(strategy, errorContext, async () => {
			if (callbacks?.executeStep) {
				await callbacks.executeStep(milestone.description, {})
			}
		})

		if (recovered) return true

		// Update context for next attempt
		errorContext = {
			...errorContext,
			recoveryAttempts: errorContext.recoveryAttempts + 1,
			previousStrategies: [...errorContext.previousStrategies, strategy],
		}
	}

	return false
}

export async function runWithCheckpointing(
	steps: (() => Promise<void>)[],
	goalId: string,
	_config: AutonomousConfig = DEFAULT_CONFIG,
	callbacks?: TaskRunnerCallbacks,
): Promise<void> {
	const goal = getGoal(goalId)
	if (!goal) {
		throw new Error(`Goal not found: ${goalId}`)
	}

	// Check for existing checkpoint
	const existingCheckpoint = await loadCheckpoint(goalId)
	let startStep = 0
	if (existingCheckpoint) {
		startStep = existingCheckpoint.stepIndex + 1
	}

	startTracking(goalId, steps.length)

	for (let i = startStep; i < steps.length; i++) {
		try {
			await steps[i]!()
			const progress = updateProgress(goalId, `Step ${i + 1}`)
			callbacks?.onProgress?.(goalId, progress)

			// Create checkpoint
			const cp = createCheckpoint(goalId, '', i, { stepIndex: i, completed: true })
			await saveCheckpoint(cp)
			callbacks?.onCheckpoint?.(goalId, cp.id)
		} catch (error) {
			setStatus(goalId, 'failed')
			throw error
		}
	}

	setStatus(goalId, 'completed')
	stopTracking(goalId)
}

export async function runAutonomously(
	goals: AutonomousGoal[],
	config: AutonomousConfig = DEFAULT_CONFIG,
	callbacks?: TaskRunnerCallbacks,
): Promise<void> {
	const prioritized = [...goals].sort((a, b) => {
		if (a.priority !== b.priority) return b.priority - a.priority
		return a.createdAt - b.createdAt
	})

	// Execute goals up to maxConcurrentGoals at a time
	const maxConcurrent = config.maxConcurrentGoals
	const errors: Error[] = []

	for (let i = 0; i < prioritized.length; i += maxConcurrent) {
		const batch = prioritized.slice(i, i + maxConcurrent)

		const results = await Promise.allSettled(
			batch.map((goal) => executeGoal(goal, config, callbacks)),
		)

		for (const result of results) {
			if (result.status === 'rejected') {
				errors.push(
					result.reason instanceof Error ? result.reason : new Error(String(result.reason)),
				)
			}
		}
	}

	if (errors.length > 0) {
		throw new AggregateError(errors, `${errors.length} goal(s) failed during autonomous execution`)
	}
}
