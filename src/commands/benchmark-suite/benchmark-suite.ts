/**
 * `/benchmark-suite` command — Run standardized benchmark suites.
 *
 * Sub-commands:
 *   run     — Run a specific benchmark suite
 *   list    — List available suites
 *   results — Show latest results
 *
 * Usage:
 *   /benchmark-suite run --suite humaneval --max-tasks 10
 *   /benchmark-suite list
 *   /benchmark-suite results
 */

import type { Command } from '../../types/command.js'

const BENCHMARK_HELP = `
Olympuz Coder — Benchmark Suite

Usage: /benchmark-suite <subcommand> [options]

Subcommands:
  run     Run a benchmark suite
  list    List available suites
  results Show latest results

Run options:
  --suite <name>           Suite to run (required)
  --model <model>          Model to evaluate
  --preset <name>          Model preset (claude-opus, gpt4o, etc.)
  --dataset <path|alias>   Dataset source
  --max-tasks <n>          Limit number of tasks
  --docker                 Enable Docker validation
  --output-dir <path>      Output directory

Available suites:
  swe-bench        SWE-bench (Verified/Lite/Full/Pro)
  humaneval        HumanEval / HumanEval+
  livecodebench    LiveCodeBench (contamination-free)
  bigcodebench     BigCodeBench (practical programming)
  aider-polyglot   Aider Polyglot (6 languages)
  terminal-bench   Terminal-Bench 2.0 (CLI tasks)

Examples:
  /benchmark-suite run --suite humaneval --max-tasks 5
  /benchmark-suite run --suite swe-bench --preset claude-opus
  /benchmark-suite list
`.trim()

function parseSimpleArgs(args: string): Record<string, string | boolean> {
	const result: Record<string, string | boolean> = {}
	const tokens = args.split(/\s+/).filter(Boolean)

	for (let i = 0; i < tokens.length; i++) {
		if (tokens[i]!.startsWith('--')) {
			const key = tokens[i]!.slice(2)
			const next = tokens[i + 1]
			if (next && !next.startsWith('--')) {
				result[key] = next
				i++
			} else {
				result[key] = true
			}
		}
	}

	return result
}

async function handleList(): Promise<string> {
	const suites = [
		{
			key: 'swe-bench',
			name: 'SWE-bench',
			tasks: '300-2294',
			description: 'Resolve real GitHub issues',
		},
		{
			key: 'humaneval',
			name: 'HumanEval',
			tasks: '164',
			description: 'Python function completion',
		},
		{
			key: 'livecodebench',
			name: 'LiveCodeBench',
			tasks: '~800',
			description: 'Contamination-free competitive programming',
		},
		{
			key: 'bigcodebench',
			name: 'BigCodeBench',
			tasks: '~1140',
			description: 'Practical programming with libraries',
		},
		{
			key: 'aider-polyglot',
			name: 'Aider Polyglot',
			tasks: '225',
			description: 'Code editing in 6 languages',
		},
		{
			key: 'terminal-bench',
			name: 'Terminal-Bench 2.0',
			tasks: '~50+',
			description: 'CLI/terminal tasks',
		},
	]

	let output = 'Available Benchmark Suites:\n\n'
	for (const s of suites) {
		output += `  ${s.key.padEnd(18)} ${s.name}\n`
		output += `  ${''.padEnd(18)} ${s.tasks} tasks — ${s.description}\n\n`
	}

	output += '\nRun: /benchmark-suite run --suite <name> --max-tasks 5'
	return output
}

async function handleRun(args: Record<string, string | boolean>): Promise<string> {
	const suite = typeof args.suite === 'string' ? args.suite : null
	if (!suite) {
		return 'Error: --suite is required. Use /benchmark-suite list to see available suites.'
	}

	// Build command to invoke the universal runner
	const runnerPath = 'scripts/benchmark/core/runner.ts'
	const parts = ['bun', 'run', runnerPath, '--suite', suite]

	if (args.model && typeof args.model === 'string') parts.push('--model', args.model)
	if (args.preset && typeof args.preset === 'string') parts.push('--preset', args.preset)
	if (args.dataset && typeof args.dataset === 'string') parts.push('--dataset', args.dataset)
	if (args['max-tasks'] && typeof args['max-tasks'] === 'string')
		parts.push('--max-tasks', args['max-tasks'])
	if (args.docker) parts.push('--docker')
	if (args['output-dir'] && typeof args['output-dir'] === 'string')
		parts.push('--output-dir', args['output-dir'])

	return `To run this benchmark, execute:\n\n\`\`\`bash\n${parts.join(' ')}\n\`\`\`\n\nOr use the shell script:\n\n\`\`\`bash\n./scripts/benchmark/run-suite.sh --suite ${suite}\n\`\`\``
}

export default {
	type: 'prompt' as const,
	name: 'benchmark-suite',
	description: 'Run standardized benchmark suites (SWE-bench, HumanEval, etc.)',
	progressMessage: 'Running benchmark suite...',
	contentLength: 0,
	source: 'builtin' as const,
	async getPromptForCommand(args: string) {
		const trimmed = args.trim()

		if (!trimmed || trimmed === 'help') {
			return [{ type: 'text' as const, text: BENCHMARK_HELP }]
		}

		if (trimmed === 'list') {
			const output = await handleList()
			return [{ type: 'text' as const, text: output }]
		}

		const parsed = parseSimpleArgs(trimmed)

		if (trimmed.startsWith('run') || parsed.suite) {
			const output = await handleRun(parsed)
			return [{ type: 'text' as const, text: output }]
		}

		if (trimmed === 'results') {
			return [
				{
					type: 'text' as const,
					text: 'Latest benchmark results are in ./benchmark-results/. Use `ls ./benchmark-results/` to view.',
				},
			]
		}

		return [{ type: 'text' as const, text: BENCHMARK_HELP }]
	},
} satisfies Command
