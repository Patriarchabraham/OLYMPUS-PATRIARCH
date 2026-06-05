import { register } from 'node:module'
import { pathToFileURL } from 'node:url'
register('./vitest.esm-loader.mjs', pathToFileURL('./'))
