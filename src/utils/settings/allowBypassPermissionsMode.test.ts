import { describe, test, expect } from 'vitest'
import { SettingsSchema } from './types.js'

describe('SettingsSchema allowBypassPermissionsMode', () => {
  test('accepts allowBypassPermissionsMode: true', () => {
    const result = SettingsSchema().safeParse({
      permissions: { allowBypassPermissionsMode: true },
    })
    expect(result.success).toBe(true)
  }, 60_000)

  test('accepts allowBypassPermissionsMode: false', () => {
    const result = SettingsSchema().safeParse({
      permissions: { allowBypassPermissionsMode: false },
    })
    expect(result.success).toBe(true)
  }, 60_000)

  test('rejects non-boolean allowBypassPermissionsMode', () => {
    const result = SettingsSchema().safeParse({
      permissions: { allowBypassPermissionsMode: 'yes' },
    })
    expect(result.success).toBe(false)
  }, 60_000)
})
