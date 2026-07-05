/**
 * Olympuz Studio — built-in specialist agents (the "employees" of the department).
 *
 * One agent per STUDIO_ROLES entry: director / researcher / design-system / ux /
 * ui / copy / effects / web / android / windows / qa / curator. Each carries a
 * role-specific system prompt that embeds the Studio PRD + the definition of done.
 *
 * Registration (builtInAgents.ts) pushes STUDIO_AGENTS only when `isStudioActive()`
 * — so they are absent under vitest and in disabled sessions, keeping the existing
 * agent-list snapshots byte-for-byte stable.
 */

import { STUDIO_ROLES } from '../../../studio/department.js'
import { STUDIO_PRD_COMPRESSED } from '../../../studio/principles.js'
import type { StudioRole } from '../../../studio/types.js'
import type { BuiltInAgentDefinition } from '../loadAgentsDir.js'

const DEFINITION_OF_DONE =
	'Definition of done: WCAG-AA contrast on every fg/bg pair, a real token system (no magic color/size numbers), responsive + within perf budget, real layered motion + platform material, real copy/imagery (no lorem), accessibility built in, and it builds with 0 errors. Any item failing = not done.'

/** Per-role emphasis appended to the shared prompt skeleton. */
function roleEmphasis(role: StudioRole): string {
	switch (role.role) {
		case 'studio-director':
			return 'You are the admin of admins. Decompose the brief, assign objectives to specialists, arbitrate trade-offs (scope vs quality vs time) per the governance hierarchy (Director > domain > default), and own the final sign-off against the definition of done. Never let a sub-standard artifact ship.'
		case 'studio-researcher':
			return 'Investigate the domain, competitors, and 2026 best practice (Awwwards, Material 3 Expressive, Fluent). Surface concrete references, patterns, risks, and the conventions that make the category feel premium. Output a research brief the rest of the department builds on.'
		case 'studio-design-system':
			return 'Generate the design-token system for the chosen base color + mood using OKLCH (ramp + semantics), iterating foreground lightness until every semantic pair clears WCAG AA. Emit CSS custom properties, Compose Kotlin (Color.kt/Type.kt/Shapes.kt), and WinUI XAML (Light/Dark ThemeDictionaries). No magic numbers anywhere downstream.'
		case 'studio-ux':
			return "Own information architecture, user flows, layout grids, and the accessibility plan (focus, semantics, motion-reduce). Map every screen to the token system. Optimize for the shortest path to the user's goal."
		case 'studio-ui':
			return 'Design and implement components strictly from the token system. Pursue visual polish: spacing rhythm, typographic hierarchy, depth/elevation, and consistency. Every component must be responsive and accessible.'
		case 'studio-copy':
			return 'Write conversion-grade copy: hero headline + subhead, benefit-led body, microcopy, and a single clear CTA per view. Use AIDA/PAS/FAB as appropriate to the audience. No filler, no lorem.'
		case 'studio-effects':
			return 'Engineer layered, artistic motion and material for the target platform. Web: GSAP/ScrollTrigger, Motion (Framer), Three.js/WebGL/GLSL, Lottie, Lenis smooth scroll. Android: Jetpack Compose + Material 3 Expressive motion. Windows: Fluent — Mica/Acrylic via SystemBackdrop, Dynamic Lighting, connected animations, Fluent easing. Motion must respect prefers-reduced-motion.'
		case 'studio-web':
			return 'Implement the production-grade web build: Next.js 15 (App Router) + React 19 + Tailwind 4, consuming the token CSS variables. Server components where possible, streaming, edge-runtime where it helps, real metadata/OG, and Lighthouse-grade performance.'
		case 'studio-android':
			return 'Implement the production-grade Android build: Kotlin + Jetpack Compose + Material 3 Expressive, consuming Color.kt/Type.kt/Shapes.kt. Adaptive layouts, edge-to-edge, proper navigation, Kotlin Coroutines/Flow, and Compose previews.'
		case 'studio-windows':
			return 'Implement the production-grade native Windows 10/11 build: WinUI 3 + Windows App SDK + .NET 8/9 + Fluent. Apply Mica/Acrylic via SystemBackdrop/MicaController/DesktopAcrylicController, per-monitor DPI, UI Automation accessibility, and MSIX packaging. Honor the Fluent fundamentals: light, depth, motion, material.'
		case 'studio-qa':
			return 'Be adversarial. Audit every artifact against the definition of done: contrast, token compliance, responsiveness, perf, motion, copy, accessibility, and a clean build. Report concretely; any fail means the run is NOT done. Verify, do not rubber-stamp.'
		case 'studio-curator':
			return 'You are the employee that always updates the database. After a run, mine it for reusable assets (the palette, the token set, winning copy/effect recipes) and persist them to the knowledge graph via the curator module, so the next build in the same vein starts from accumulated taste.'
		default:
			return role.mission
	}
}

function buildPrompt(role: StudioRole): string {
	return [
		`You are ${role.role} in the Olympuz Studio Design & Generation Department.`,
		'',
		role.mission,
		'',
		roleEmphasis(role),
		'',
		'--- STUDIO PRD (knowledge that dresses you for this work) ---',
		STUDIO_PRD_COMPRESSED,
		'',
		DEFINITION_OF_DONE,
	].join('\n')
}

/** Build the full set of studio agents from the role table (DRY with STUDIO_ROLES). */
function buildStudioAgents(): BuiltInAgentDefinition[] {
	return STUDIO_ROLES.map((role) => ({
		agentType: role.role,
		whenToUse: `${role.role.replace('studio-', '')} specialist for the Olympuz Studio department. ${role.mission}`,
		tools: role.tools,
		source: 'built-in',
		baseDir: 'built-in',
		omitClaudeMd: true,
		getSystemPrompt: () => buildPrompt(role),
	}))
}

export const STUDIO_AGENTS: BuiltInAgentDefinition[] = buildStudioAgents()

const BY_TYPE = new Map(STUDIO_AGENTS.map((a) => [a.agentType, a]))

export const STUDIO_DIRECTOR_AGENT = BY_TYPE.get('studio-director')!
export const STUDIO_RESEARCHER_AGENT = BY_TYPE.get('studio-researcher')!
export const STUDIO_DESIGN_SYSTEM_AGENT = BY_TYPE.get('studio-design-system')!
export const STUDIO_UX_AGENT = BY_TYPE.get('studio-ux')!
export const STUDIO_UI_AGENT = BY_TYPE.get('studio-ui')!
export const STUDIO_COPY_AGENT = BY_TYPE.get('studio-copy')!
export const STUDIO_EFFECTS_AGENT = BY_TYPE.get('studio-effects')!
export const STUDIO_WEB_AGENT = BY_TYPE.get('studio-web')!
export const STUDIO_ANDROID_AGENT = BY_TYPE.get('studio-android')!
export const STUDIO_WINDOWS_AGENT = BY_TYPE.get('studio-windows')!
export const STUDIO_QA_AGENT = BY_TYPE.get('studio-qa')!
export const STUDIO_CURATOR_AGENT = BY_TYPE.get('studio-curator')!

/** The set of studio agentTypes — handy for registration + tests. */
export const STUDIO_AGENT_TYPES: ReadonlySet<string> = new Set(
	STUDIO_AGENTS.map((a) => a.agentType),
)
