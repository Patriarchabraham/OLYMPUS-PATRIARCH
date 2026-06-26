/**
 * Aider Polyglot suite registration.
 *
 * Registers the adapter in the global suite registry.
 */

import { registerSuite } from '../../core/config'
import { aiderPolyglotAdapter } from './adapter'

registerSuite({
	key: 'aider-polyglot',
	adapter: aiderPolyglotAdapter,
	defaultDataset:
		'https://huggingface.co/datasets/aider-ai/polyglot-benchmark/resolve/main/polyglot-benchmark.jsonl',
})
