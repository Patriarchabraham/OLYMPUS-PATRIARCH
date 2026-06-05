/**
 * CJS module that patches Node's module resolution to handle .js → .ts
 * Required for Vitest to work with TypeScript ESM import conventions.
 */
const Module = require('node:module')
const path = require('node:path')
const fs = require('node:fs')

const originalResolveFilename = Module._resolveFilename
Module._resolveFilename = function (request, ...rest) {
  if (typeof request === 'string' && request.endsWith('.js') && !request.includes('node_modules')) {
    const tsPath = request.replace(/\.js$/, '.ts')
    try {
      return originalResolveFilename.call(this, tsPath, ...rest)
    } catch {
      // fall through to original
    }
  }
  return originalResolveFilename.call(this, request, ...rest)
}
