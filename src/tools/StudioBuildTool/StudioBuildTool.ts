/**
 * Olympuz Studio — StudioBuild tool.
 *
 * Lets the model (or a user via /studio run) trigger the department for a brief:
 * detects intent, generates the WCAG-verified design tokens for the chosen base
 * color + mood + platform, builds the department delegation plan, and returns
 * the delegation instructions + token digest. The MODEL then executes the plan
 * via the existing Agent/swarm runtime — Studio does not re-implement spawning.
 *
 * Dormant under vitest and when Studio is disabled (`isEnabled = isStudioActive()`),
 * so tool-list snapshots stay byte-for-byte stable.
 */

import { z } from 'zod/v4'
import { formatPlanForDelegation } from '../../studio/department.js'
import { STUDIO_PRD_VERSION } from '../../studio/principles.js'
import { getStudioEngine, isStudioActive } from '../../studio/studioEngine.js'
import type { StudioAesthetic, StudioIntent, StudioPlatform } from '../../studio/types.js'
import { buildTool, type ToolDef } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'

export const STUDIO_BUILD_TOOL_NAME = 'StudioBuild'

const PLATFORMS: StudioPlatform[] = ['web', 'android', 'windows']
const MOODS: StudioAesthetic[] = [
	'neutral-adaptive',
	'luxury-dark-gold',
	'calm',
	'vibrant',
	'minimal',
	'bold',
]

const DESCRIPTION = [
	'Activate the Olympuz Studio Design & Generation Department for a build brief.',
	'Returns the detected intent, a WCAG-AA-verified design-token digest (CSS / Compose Kotlin / WinUI XAML),',
	'and the department delegation plan (which specialist agents run, in what order) for web, Android, or Windows.',
	'You (the main agent) then execute the plan via the Agent tool. Use when the user wants to design/generate',
	'a website, web app, landing page, dashboard, Android app, or Windows 10/11 desktop app at the highest quality.',
].join(' ')

const inputSchema = lazySchema(() =>
	z.strictObject({
		brief: z
			.string()
			.min(1)
			.describe('The build brief in natural language (e.g. "a landing page for a fintech").'),
		platform: z
			.enum(PLATFORMS as [StudioPlatform, ...StudioPlatform[]])
			.optional()
			.describe('Target platform. If omitted, inferred from the brief (default web).'),
		baseColor: z
			.string()
			.optional()
			.describe('Base color as a hex string (e.g. "#2563eb"). Omit for adaptive neutral.'),
		mood: z
			.enum(MOODS as [StudioAesthetic, ...StudioAesthetic[]])
			.optional()
			.describe('Aesthetic mood. Omit for the configured default (neutral-adaptive).'),
	}),
)
type InputSchema = ReturnType<typeof inputSchema>

const outputSchema = lazySchema(() =>
	z.object({
		intent: z.object({
			isBuildRequest: z.boolean(),
			platform: z.string(),
			kind: z.string(),
			confidence: z.number(),
		}),
		tokensDigest: z.object({
			platform: z.string(),
			mood: z.string(),
			baseColor: z.string(),
			contrastVerified: z.boolean(),
			bg: z.string(),
			fg: z.string(),
			accent: z.string(),
			border: z.string(),
			fontFamily: z.string(),
		}),
		delegationInstructions: z.string(),
		principlesRef: z.string(),
	}),
)
type OutputSchema = ReturnType<typeof outputSchema>
export type StudioBuildOutput = z.infer<OutputSchema>

export const StudioBuildTool = buildTool({
	name: STUDIO_BUILD_TOOL_NAME,
	searchHint: 'activate the Studio design department for a build brief',
	maxResultSizeChars: 100_000,
	async description() {
		return DESCRIPTION
	},
	async prompt() {
		return DESCRIPTION
	},
	get inputSchema(): InputSchema {
		return inputSchema()
	},
	get outputSchema(): OutputSchema {
		return outputSchema()
	},
	userFacingName() {
		return 'StudioBuild'
	},
	isEnabled() {
		// Dormant in tests + when Studio is disabled — keeps tool-list snapshots stable.
		return isStudioActive()
	},
	isConcurrencySafe() {
		return true
	},
	isReadOnly() {
		return true
	},
	renderToolUseMessage() {
		return null
	},
	async call(input) {
		const engine = getStudioEngine()
		const detected = engine.detectIntent(input.brief)

		const platform: StudioPlatform =
			input.platform ?? (detected.platform === 'unknown' ? 'web' : detected.platform)
		// Override the detected platform so planBuild routes to the right engineer.
		const intent: StudioIntent = { ...detected, platform }

		const tokens = engine.generateTokens({
			baseColor: input.baseColor,
			mood: input.mood,
			platform,
		})
		const plan = engine.planBuild(intent)

		const output: StudioBuildOutput = {
			intent: {
				isBuildRequest: intent.isBuildRequest,
				platform: intent.platform,
				kind: intent.kind,
				confidence: intent.confidence,
			},
			tokensDigest: {
				platform: tokens.platform,
				mood: tokens.mood,
				baseColor: tokens.baseColor,
				contrastVerified: tokens.contrastVerified,
				bg: tokens.color.semantic.bg.hex,
				fg: tokens.color.semantic.fg.hex,
				accent: tokens.color.semantic.accent.hex,
				border: tokens.color.semantic.border.hex,
				fontFamily: tokens.typography.fontFamily,
			},
			delegationInstructions: formatPlanForDelegation(plan),
			principlesRef: `Olympuz Studio PRD v${STUDIO_PRD_VERSION}`,
		}
		return { data: output }
	},
	mapToolResultToToolResultBlockParam(content, toolUseID) {
		const out = content as StudioBuildOutput
		const lines = [
			`Studio Department — ${out.tokensDigest.platform} build (${out.tokensDigest.mood})`,
			`Intent: ${out.intent.kind} | confidence ${out.intent.confidence.toFixed(2)} | build=${out.intent.isBuildRequest}`,
			`Tokens: base=${out.tokensDigest.baseColor} mood=${out.tokensDigest.mood} contrastAA=${out.tokensDigest.contrastVerified}`,
			`  bg=${out.tokensDigest.bg} fg=${out.tokensDigest.fg} accent=${out.tokensDigest.accent} border=${out.tokensDigest.border}`,
			`  font=${out.tokensDigest.fontFamily}`,
			`Principles: ${out.principlesRef}`,
			'',
			out.delegationInstructions,
		]
		return {
			tool_use_id: toolUseID,
			type: 'tool_result',
			content: lines.join('\n'),
		}
	},
} satisfies ToolDef<InputSchema, StudioBuildOutput>)
