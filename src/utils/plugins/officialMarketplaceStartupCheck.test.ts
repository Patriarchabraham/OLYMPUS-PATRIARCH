import { beforeEach, describe, expect, vi, test } from 'vitest'

type TestGlobalConfig = {
  officialMarketplaceAutoInstallAttempted?: boolean
  officialMarketplaceAutoInstalled?: boolean
  officialMarketplaceAutoInstallFailReason?:
    | 'policy_blocked'
    | 'git_unavailable'
    | 'gcs_unavailable'
    | 'unknown'
  officialMarketplaceAutoInstallRetryCount?: number
  officialMarketplaceAutoInstallLastAttemptTime?: number
  officialMarketplaceAutoInstallNextRetryTime?: number
}

let config: TestGlobalConfig = {}
let knownMarketplaces: Record<string, unknown> = {}
const {
  saveGlobalConfig,
  saveKnownMarketplacesConfig,
  fetchOfficialMarketplaceFromGcs,
  addMarketplaceSource,
} = vi.hoisted(() => {
  let _config: TestGlobalConfig = {}
  let _known: Record<string, unknown> = {}
  return {
    saveGlobalConfig: vi.fn(
      (updater: (current: TestGlobalConfig) => TestGlobalConfig) => {
        _config = updater(_config)
      },
    ),
    saveKnownMarketplacesConfig: vi.fn(
      async (next: Record<string, unknown>) => {
        _known = next
      },
    ),
    fetchOfficialMarketplaceFromGcs: vi.fn(async () => 'sha'),
    addMarketplaceSource: vi.fn(async () => ({
      name: 'claude-plugins-official',
      alreadyMaterialized: false,
      resolvedSource: {},
    })),
  }
})

vi.mock('../../services/analytics/growthbook.js', () => ({
  getFeatureValue_CACHED_MAY_BE_STALE: () => true,
}))

vi.mock('../../services/analytics/index.js', () => ({
  logEvent: vi.fn(() => {}),
}))

vi.mock('../config.js', () => ({
  getGlobalConfig: () => config,
  saveGlobalConfig,
}))

vi.mock('../debug.js', () => ({
  logForDebugging: vi.fn(() => {}),
}))

vi.mock('../log.js', () => ({
  logError: vi.fn(() => {}),
}))

vi.mock('./gitAvailability.js', () => ({
  checkGitAvailable: async () => true,
  markGitUnavailable: vi.fn(() => {}),
}))

vi.mock('./marketplaceHelpers.js', () => ({
  isSourceAllowedByPolicy: () => true,
}))

vi.mock('./marketplaceManager.js', () => ({
  addMarketplaceSource,
  getMarketplacesCacheDir: () => '/tmp/Mythos Patriarch-marketplaces',
  loadKnownMarketplacesConfig: async () => knownMarketplaces,
  saveKnownMarketplacesConfig,
}))

vi.mock('./officialMarketplaceGcs.js', () => ({
  fetchOfficialMarketplaceFromGcs,
}))

const { checkAndInstallOfficialMarketplace } = await import(
  './officialMarketplaceStartupCheck.js'
)

beforeEach(() => {
  config = {}
  knownMarketplaces = {}
  saveGlobalConfig.mockClear()
  saveKnownMarketplacesConfig.mockClear()
  fetchOfficialMarketplaceFromGcs.mockClear()
  fetchOfficialMarketplaceFromGcs.mockImplementation(async () => 'sha')
  addMarketplaceSource.mockClear()
})

describe('checkAndInstallOfficialMarketplace', () => {
  test('repairs missing known marketplace even when global config says installed', async () => {
    config = {
      officialMarketplaceAutoInstallAttempted: true,
      officialMarketplaceAutoInstalled: true,
    }

    const result = await checkAndInstallOfficialMarketplace()

    expect(result).toEqual({ installed: true, skipped: false })
    expect(fetchOfficialMarketplaceFromGcs).toHaveBeenCalled()
    expect(saveKnownMarketplacesConfig).toHaveBeenCalled()
    expect(knownMarketplaces).toHaveProperty('claude-plugins-official')
    expect(config.officialMarketplaceAutoInstalled).toBe(true)
    expect(config.officialMarketplaceAutoInstallFailReason).toBeUndefined()
  })

  test('uses known marketplaces as the installed source of truth', async () => {
    knownMarketplaces = {
      'claude-plugins-official': {
        installLocation: '/tmp/Mythos Patriarch-marketplaces/claude-plugins-official',
      },
    }

    const result = await checkAndInstallOfficialMarketplace()

    expect(result).toEqual({
      installed: false,
      skipped: true,
      reason: 'already_installed',
    })
    expect(fetchOfficialMarketplaceFromGcs).not.toHaveBeenCalled()
    expect(config.officialMarketplaceAutoInstallAttempted).toBe(true)
    expect(config.officialMarketplaceAutoInstalled).toBe(true)
  })
})
