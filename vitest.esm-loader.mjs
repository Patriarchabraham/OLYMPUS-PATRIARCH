import { resolve as pathResolve, dirname, sep } from 'path'
import { existsSync } from 'fs'
import { pathToFileURL, fileURLToPath } from 'url'

const SRC_SEG = sep + 'src' + sep
const JSONC_UMD = pathResolve(process.cwd(), 'node_modules/jsonc-parser/lib/umd/main.js')

export function resolve(specifier, context, nextResolve) {
  // Handle raw Windows paths (C:\...) as specifiers  
  if (/^[A-Za-z]:[\\/]/.test(specifier)) {
    try {
      return { url: pathToFileURL(specifier).href, shortCircuit: true }
    } catch { /* fall through */ }
  }
  
  // Redirect jsonc-parser ESM → UMD to avoid Node resolution issues
  if (specifier.includes('jsonc-parser/lib/esm/')) {
    return { url: pathToFileURL(JSONC_UMD).href, shortCircuit: true }
  }
  
  // Resolve .js → .ts for src/ files where .js doesn't exist
  if (specifier.endsWith('.js') && !specifier.includes('node_modules')) {
    let basePath = null
    
    try {
      if (/^[A-Za-z]:[\\/]/.test(specifier)) {
        basePath = specifier.replace(/\.js$/, '')
      } else if (specifier.startsWith('file://')) {
        basePath = fileURLToPath(specifier).replace(/\.js$/, '')
      } else if (specifier.startsWith('./') || specifier.startsWith('../')) {
        if (context.parentURL) {
          const parentDir = dirname(fileURLToPath(context.parentURL))
          basePath = pathResolve(parentDir, specifier.replace(/\.js$/, ''))
        }
      } else if (specifier.startsWith('src/')) {
        basePath = pathResolve(process.cwd(), specifier.replace(/\.js$/, ''))
      }
    } catch { /* fall through */ }

    if (basePath && basePath.includes(SRC_SEG) && !existsSync(basePath + '.js')) {
      for (const ext of ['.ts', '.tsx']) {
        if (existsSync(basePath + ext)) {
          return { url: pathToFileURL(basePath + ext).href, shortCircuit: true }
        }
      }
    }
  }
  
  return nextResolve(specifier, context)
}
