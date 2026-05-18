import { resetFeatureFlags } from './vitest.bun-bundle-mock'

afterEach(() => {
  resetFeatureFlags()
})
