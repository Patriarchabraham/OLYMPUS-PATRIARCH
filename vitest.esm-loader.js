/**
 * Node ESM custom loader that resolves .js imports to .ts files
 * and transforms TypeScript to JavaScript using esbuild.
 * Only handles source files (not node_modules).
 */
import { resolve as pathResolve, dirname } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

const nodeRequire = createRequire(import.meta.url)
const projectSrc = pathResolve(process.cwd(), 'src')

export function resolve(specifier, context, nextResolve) {
  // Only intercept .js imports from our src/ files
  if (!specifier.endsWith('.js')) {
    return nextResolve(specifier, context, nextResolve)
  }

  const { parentURL } = context

  // Only intercept if parent is one of our source files
  if (!parentURL || !parentURL.includes('/src/') && !parentURL.includes('\\src\\')) {
    return nextResolve(specifier, context, nextResolve)
  }

  // Skip node_modules imports
  if (specifier.includes('node_modules')) {
    return nextResolve(specifier, context, nextResolve)
  }

  let tsPath
  if (specifier.startsWith('.')) {
    const parentDir = dirname(fileURLToPath(parentURL))
    tsPath = pathResolve(parentDir, specifier.replace(/\.js$/, '.ts'))
  } else if (specifier.startsWith('src/')) {
    tsPath = pathResolve(process.cwd(), specifier.replace(/\.js$/, '.ts'))
  } else {
    return nextResolve(specifier, context, nextResolve)
  }

  // Only intercept if the resolved .ts path is within our src/ directory
  if (!tsPath.startsWith(projectSrc)) {
    return nextResolve(specifier, context, nextResolve)
  }

  if (existsSync(tsPath)) {
    return { url: pathToFileURL(tsPath).href + '?js-to-ts', shortCircuit: true, format: 'module' }
  }

  return nextResolve(specifier, context, nextResolve)
}

export function load(url, context, nextLoad) {
  if (!url.includes('?js-to-ts')) {
    return nextLoad(url, context, nextLoad)
  }

  const cleanUrl = url.replace('?js-to-ts', '')
  const filePath = fileURLToPath(cleanUrl)

  try {
    const { transformSync } = nodeRequire('esbuild')
    const source = readFileSync(filePath, 'utf-8')
    const result = transformSync(source, {
      loader: filePath.endsWith('.tsx') ? 'tsx' : 'ts',
      format: 'esm',
      target: 'es2022',
      sourcemap: 'inline',
      sourcefile: filePath,
    })
    return { source: result.code, format: 'module', shortCircuit: true }
  } catch (e) {
    console.error(`[esm-loader] Error transforming ${filePath}:`, e.message || e)
    return nextLoad(url.replace('?js-to-ts', ''), context, nextLoad)
  }
}
