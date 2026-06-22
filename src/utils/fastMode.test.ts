import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest'

const originalEnv = { ...process.env }

// vi.mock() factories are hoisted to module top by Vitest and cannot close over
// the installCommonMocks(options) parameter (ported from bun:test). Hold per-test
// mock state in a hoisted mutable object that the factories read from.
const mockState = vi.hoisted(() => ({
	apiKey: null as string | null,
	oauthToken: null as string | null,
	hasProfileScope: false,
	axiosReject: false,
}))

async function importFreshFastModeModule() {
	vi.resetModules()
	return vi.importActual<typeof import('./fastMode')>('./fastMode.ts')
}

// Cached single import — paid once in beforeAll (with extended timeout) to
// avoid per-test vi.importActual() cold-transform hangs (>30s) under the
// esbuild CJS loader for fastMode's transitive graph (auth/providers/model/
// settings/growthbook). The hoisted mockState above is read at call time, so a
// single cached module still respects per-test mock configuration.
let fastModeModule: Awaited<ReturnType<typeof importFreshFastModeModule>> | null = null

async function getCachedFastModeModule() {
	if (!fastModeModule) {
		fastModeModule = await importFreshFastModeModule()
	}
	return fastModeModule
}

function installCommonMocks(options?: {
	cachedEnabled?: boolean
	apiKey?: string | null
	oauthToken?: string | null
	hasProfileScope?: boolean
	axiosReject?: boolean
}) {
	mockState.apiKey = options?.apiKey ?? null
	mockState.oauthToken = options?.oauthToken ?? null
	mockState.hasProfileScope = options?.hasProfileScope ?? false
	mockState.axiosReject = options?.axiosReject ?? false

	vi.mock('axios', () => ({
		default: {
			get: async () => {
				// Read at call time so per-test mockState.axiosReject toggles apply
				// even though the module is imported once (cached).
				if (mockState.axiosReject) {
					throw new Error('network fail')
				}
				return { data: { enabled: false, disabled_reason: 'preference' } }
			},
			isAxiosError: () => false,
		},
	}))

	vi.mock('src/services/analytics/growthbook.js', () => ({
		onGrowthBookRefresh: () => () => {},
		hasGrowthBookEnvOverride: () => false,
		getAllGrowthBookFeatures: () => ({}),
		getGrowthBookConfigOverrides: () => ({}),
		setGrowthBookConfigOverride: () => {},
		clearGrowthBookConfigOverrides: () => {},
		getApiBaseUrlHost: () => undefined,
		initializeGrowthBook: async () => null,
		checkStatsigFeatureGate_CACHED_MAY_BE_STALE: () => false,
		getFeatureValue_CACHED_MAY_BE_STALE: (name: string, defaultValue: unknown) =>
			name === 'tengu_penguins_off' ? false : defaultValue,
		getFeatureValue_CACHED_WITH_REFRESH: (name: string, defaultValue: unknown) =>
			name === 'tengu_penguins_off' ? false : defaultValue,
		getDynamicConfig_CACHED_MAY_BE_STALE: (_name: string, defaultValue: unknown) => defaultValue,
		checkGate_CACHED_OR_BLOCKING: async () => false,
		checkSecurityRestrictionGate: async () => false,
		getFeatureValue_DEPRECATED: async (_name: string, defaultValue: unknown) => defaultValue,
		refreshGrowthBookAfterAuthChange: () => {},
		resetGrowthBook: () => {},
		refreshGrowthBookFeatures: async () => {},
		setupPeriodicGrowthBookRefresh: () => {},
		stopPeriodicGrowthBookRefresh: () => {},
		getDynamicConfig_BLOCKS_ON_INIT: async (_name: string, defaultValue: unknown) => defaultValue,
	}))

	vi.mock('src/constants/oauth.js', () => ({
		fileSuffixForOauthConfig: () => '',
		CLAUDE_AI_INFERENCE_SCOPE: 'user:inference',
		CLAUDE_AI_PROFILE_SCOPE: 'user:profile',
		OAUTH_BETA_HEADER: 'test-beta',
		CONSOLE_OAUTH_SCOPES: ['org:create_api_key', 'user:profile'],
		CLAUDE_AI_OAUTH_SCOPES: ['user:profile', 'user:inference'],
		ALL_OAUTH_SCOPES: ['org:create_api_key', 'user:profile', 'user:inference'],
		MCP_CLIENT_METADATA_URL: 'https://claude.ai/oauth/claude-code-client-metadata',
		getOauthConfig: () => ({
			BASE_API_URL: 'https://api.anthropic.com',
			CONSOLE_AUTHORIZE_URL: 'https://platform.claude.com/oauth/authorize',
			CLAUDE_AI_AUTHORIZE_URL: 'https://claude.com/cai/oauth/authorize',
			CLAUDE_AI_ORIGIN: 'https://claude.ai',
			TOKEN_URL: 'https://platform.claude.com/v1/oauth/token',
			API_KEY_URL: 'https://api.anthropic.com/api/oauth/claude_cli/create_api_key',
			ROLES_URL: 'https://api.anthropic.com/api/oauth/claude_cli/roles',
			CONSOLE_SUCCESS_URL: 'https://platform.claude.com/oauth/code/success',
			CLAUDEAI_SUCCESS_URL: 'https://platform.claude.com/oauth/code/success',
			MANUAL_REDIRECT_URL: 'https://platform.claude.com/oauth/code/callback',
			CLIENT_ID: 'test-client-id',
			OAUTH_FILE_SUFFIX: '',
			MCP_PROXY_URL: 'https://mcp-proxy.anthropic.com',
			MCP_PROXY_PATH: '/v1/mcp/{server_id}',
		}),
	}))

	vi.mock('./auth.js', () => ({
		isAnthropicAuthEnabled: () => true,
		getAuthTokenSource: () => 'none',
		getAnthropicApiKey: () => mockState.apiKey ?? null,
		hasAnthropicApiKeyAuth: () => Boolean(mockState.apiKey),
		getAnthropicApiKeyWithSource: () => ({
			apiKey: mockState.apiKey ?? null,
			source: mockState.apiKey ? 'env' : null,
		}),
		getConfiguredApiKeyHelper: () => undefined,
		isAwsAuthRefreshFromProjectSettings: () => false,
		isAwsCredentialExportFromProjectSettings: () => false,
		calculateApiKeyHelperTTL: () => 0,
		getApiKeyHelperElapsedMs: () => 0,
		getApiKeyFromApiKeyHelper: async () => null,
		getApiKeyFromApiKeyHelperCached: () => null,
		clearApiKeyHelperCache: () => {},
		prefetchApiKeyFromApiKeyHelperIfSafe: () => {},
		refreshAwsAuth: async () => false,
		refreshAndGetAwsCredentials: async () => null,
		clearAwsCredentialsCache: () => {},
		isGcpAuthRefreshFromProjectSettings: () => false,
		checkGcpCredentialsValid: async () => false,
		refreshGcpAuth: async () => false,
		refreshGcpCredentialsIfNeeded: async () => false,
		clearGcpCredentialsCache: () => {},
		prefetchGcpCredentialsIfSafe: () => {},
		prefetchAwsCredentialsAndBedRockInfoIfSafe: () => {},
		getApiKeyFromConfigOrMacOSKeychain: () => null,
		saveApiKey: async () => {},
		isCustomApiKeyApproved: () => false,
		removeApiKey: async () => {},
		saveOAuthTokensIfNeeded: () => ({ didSave: false }),
		getClaudeAIOAuthTokens: () =>
			mockState.oauthToken ? { accessToken: mockState.oauthToken } : null,
		clearOAuthTokenCache: () => {},
		handleOAuth401Error: async () => {},
		getClaudeAIOAuthTokensAsync: async () =>
			mockState.oauthToken ? { accessToken: mockState.oauthToken } : null,
		checkAndRefreshOAuthTokenIfNeeded: async () => null,
		isClaudeAISubscriber: () => Boolean(mockState.oauthToken),
		hasProfileScope: () => mockState.hasProfileScope ?? false,
		is1PApiCustomer: () => Boolean(mockState.apiKey),
		getOauthAccountInfo: () => undefined,
		isOverageProvisioningAllowed: () => false,
		hasOpusAccess: () => false,
		getSubscriptionType: () => null,
		isMaxSubscriber: () => false,
		isTeamSubscriber: () => false,
		isTeamPremiumSubscriber: () => false,
		isEnterpriseSubscriber: () => false,
		isProSubscriber: () => false,
		getRateLimitTier: () => null,
		getSubscriptionName: () => '',
		isUsing3PServices: () => false,
		isOtelHeadersHelperFromProjectOrLocalSettings: () => false,
		getOtelHeadersFromHelper: () => ({}),
		isConsumerSubscriber: () => false,
		getAccountInformation: () => undefined,
		validateForceLoginOrg: async () => ({ ok: true }),
	}))

	vi.mock('./model/providers.js', () => ({
		getAPIProvider: () => 'firstParty',
		getAPIProviderForStatsig: () => 'firstParty',
		isFirstPartyAnthropicBaseUrl: () => true,
		isGithubNativeAnthropicMode: () => false,
		usesAnthropicAccountFlow: () => true,
	}))
}

async function prepareFastModeTestState(): Promise<void> {
	const { setIsInteractive } = await import('../bootstrap/state.js')
	setIsInteractive(true)
	const { DEFAULT_GLOBAL_CONFIG, _setGlobalConfigCacheForTesting } = await import('./config.js')
	_setGlobalConfigCacheForTesting({
		...DEFAULT_GLOBAL_CONFIG,
		penguinModeOrgEnabled: false,
	})
}

function forceFirstPartyProviderEnv(): void {
	delete process.env.CLAUDE_CODE_USE_OPENAI
	delete process.env.CLAUDE_CODE_USE_GITHUB
	delete process.env.CLAUDE_CODE_USE_GEMINI
	delete process.env.CLAUDE_CODE_USE_BEDROCK
	delete process.env.CLAUDE_CODE_USE_VERTEX
	delete process.env.CLAUDE_CODE_USE_FOUNDRY
	delete process.env.CLAUDE_CODE_USE_MISTRAL
	delete process.env.NVIDIA_NIM
	delete process.env.MINIMAX_API_KEY
	delete process.env.XAI_API_KEY
	delete process.env.OPENAI_BASE_URL
	delete process.env.OPENAI_API_BASE
	delete process.env.OPENAI_MODEL
}

afterEach(async () => {
	vi.restoreAllMocks()
	process.env = { ...originalEnv }
	const { resetStateForTests } = await import('../bootstrap/state.js')
	resetStateForTests()
	const { _setGlobalConfigCacheForTesting } = await import('./config.js')
	_setGlobalConfigCacheForTesting(null)
})

describe('fastMode ant-only fallback cleanup', () => {
	beforeAll(async () => {
		// Register hoisted mocks once and pay the one-time cold transform/import
		// of fastMode (and its transitive graph) with an extended timeout. Under
		// the esbuild CJS loader with Vite's inline-everything config this first
		// import can exceed the default 30s hook timeout.
		installCommonMocks({ cachedEnabled: false })
		await getCachedFastModeModule()
	}, 120_000)

	test('resolveFastModeStatusFromCache does not force-enable from USER_TYPE=ant', async () => {
		process.env.USER_TYPE = 'ant'
		forceFirstPartyProviderEnv()
		installCommonMocks({ cachedEnabled: false })

		const { resolveFastModeStatusFromCache, getFastModeUnavailableReason } =
			await getCachedFastModeModule()
		await prepareFastModeTestState()

		resolveFastModeStatusFromCache()

		expect(getFastModeUnavailableReason()).toBe('Fast mode is currently unavailable')
	})

	test('prefetchFastModeStatus without auth does not force-enable from USER_TYPE=ant', async () => {
		process.env.USER_TYPE = 'ant'
		forceFirstPartyProviderEnv()
		installCommonMocks({ cachedEnabled: false, apiKey: null, oauthToken: null })

		const { prefetchFastModeStatus, getFastModeUnavailableReason } = await getCachedFastModeModule()
		await prepareFastModeTestState()

		await prefetchFastModeStatus()

		expect(getFastModeUnavailableReason()).toBe('Fast mode has been disabled by your organization')
	})

	test('prefetchFastModeStatus network failure does not force-enable from USER_TYPE=ant', async () => {
		process.env.USER_TYPE = 'ant'
		forceFirstPartyProviderEnv()
		installCommonMocks({
			cachedEnabled: false,
			apiKey: 'test-key',
			axiosReject: true,
		})

		const { prefetchFastModeStatus, getFastModeUnavailableReason } = await getCachedFastModeModule()
		await prepareFastModeTestState()

		await prefetchFastModeStatus()

		expect(getFastModeUnavailableReason()).toBe(
			'Fast mode unavailable due to network connectivity issues',
		)
	})
})
