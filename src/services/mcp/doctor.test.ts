import { expect, test } from 'vitest'

import type { ValidationError } from '../../utils/settings/validation.js'

import {
	buildEmptyDoctorReport,
	doctorAllServers,
	doctorServer,
	findingsFromValidationErrors,
	type McpDoctorDependencies,
} from './doctor.js'

function stdioConfig(scope: 'local' | 'project' | 'user' | 'enterprise', command: string) {
	return {
		type: 'stdio' as const,
		command,
		args: [],
		scope,
	}
}

function makeDependencies(overrides: Record<string, unknown> = {}): McpDoctorDependencies {
	return {
		getAllMcpConfigs: async () => ({ servers: {}, errors: [] }),
		getMcpConfigsByScope: () => ({ servers: {}, errors: [] }),
		getProjectMcpServerStatus: () => 'approved',
		isMcpServerDisabled: () => false,
		describeMcpConfigFilePath: (scope) => `scope://${scope}`,
		clearServerCache: async () => {},
		connectToServer: async (name, config) => ({
			name,
			type: 'connected',
			capabilities: {},
			config,
			cleanup: async () => {},
		}),
		...overrides,
	} as unknown as McpDoctorDependencies
}

test('buildEmptyDoctorReport returns zeroed summary', () => {
	const report = buildEmptyDoctorReport({
		configOnly: true,
		scopeFilter: 'project',
		targetName: 'filesystem',
	})

	expect(report.targetName).toBe('filesystem')
	expect(report.scopeFilter).toBe('project')
	expect(report.configOnly).toBe(true)
	expect(report.summary).toEqual({
		totalReports: 0,
		healthy: 0,
		warnings: 0,
		blocking: 0,
	})
	expect(report.findings).toEqual([])
	expect(report.servers).toEqual([])
})

test('findingsFromValidationErrors maps missing env warnings into doctor findings', () => {
	const validationErrors: ValidationError[] = [
		{
			file: '.mcp.json',
			path: 'mcpServers.filesystem',
			message: 'Missing environment variables: API_KEY, API_URL',
			suggestion: 'Set the following environment variables: API_KEY, API_URL',
			mcpErrorMetadata: {
				scope: 'project',
				serverName: 'filesystem',
				severity: 'warning',
			},
		},
	]

	const findings = findingsFromValidationErrors(validationErrors)

	expect(findings.length).toBe(1)
	expect(findings[0]).toEqual({
		blocking: false,
		code: 'config.missing_env_vars',
		message: 'Missing environment variables: API_KEY, API_URL',
		remediation: 'Set the following environment variables: API_KEY, API_URL',
		scope: 'project',
		serverName: 'filesystem',
		severity: 'warn',
		sourcePath: '.mcp.json',
	})
})

test('findingsFromValidationErrors maps Windows npx warnings into doctor findings', () => {
	const validationErrors: ValidationError[] = [
		{
			file: '.mcp.json',
			path: 'mcpServers.node-tools',
			message: "Windows requires 'cmd /c' wrapper to execute npx",
			suggestion:
				'Change command to "cmd" with args ["/c", "npx", ...]. See: https://code.claude.com/docs/en/mcp#configure-mcp-servers',
			mcpErrorMetadata: {
				scope: 'project',
				serverName: 'node-tools',
				severity: 'warning',
			},
		},
	]

	const findings = findingsFromValidationErrors(validationErrors)

	expect(findings.length).toBe(1)
	expect(findings[0]?.code).toBe('config.windows_npx_wrapper_required')
	expect(findings[0]?.serverName).toBe('node-tools')
	expect(findings[0]?.severity).toBe('warn')
	expect(findings[0]?.blocking).toBe(false)
})

test('findingsFromValidationErrors maps fatal parse errors into blocking findings', () => {
	const validationErrors: ValidationError[] = [
		{
			file: 'C:/repo/.mcp.json',
			path: '',
			message: 'MCP config is not a valid JSON',
			suggestion: 'Fix the JSON syntax errors in the file',
			mcpErrorMetadata: {
				scope: 'project',
				severity: 'fatal',
			},
		},
	]

	const findings = findingsFromValidationErrors(validationErrors)

	expect(findings.length).toBe(1)
	expect(findings[0]?.code).toBe('config.invalid_json')
	expect(findings[0]?.severity).toBe('error')
	expect(findings[0]?.blocking).toBe(true)
})

test('doctorAllServers reports global validation findings once without duplicating them into every server', async () => {
	const localConfig = stdioConfig('local', 'node-local')
	const deps = makeDependencies({
		getAllMcpConfigs: async () => ({
			servers: { filesystem: localConfig },
			errors: [],
		}),
		getMcpConfigsByScope: (scope) =>
			scope === 'project'
				? {
						servers: {},
						errors: [
							{
								file: '.mcp.json',
								path: '',
								message: 'MCP config is not a valid JSON',
								suggestion: 'Fix the JSON syntax errors in the file',
								mcpErrorMetadata: {
									scope: 'project',
									severity: 'fatal',
								},
							},
						],
					}
				: scope === 'local'
					? { servers: { filesystem: localConfig }, errors: [] }
					: { servers: {}, errors: [] },
	})

	const report = await doctorAllServers({ configOnly: true }, deps)

	expect(report.summary.totalReports).toBe(1)
	expect(report.summary.blocking).toBe(1)
	expect(report.findings.length).toBe(1)
	expect(report.findings[0]?.code).toBe('config.invalid_json')
	expect(report.servers[0]?.findings).toEqual([])
})

test('doctorServer explains same-name shadowing across scopes', async () => {
	const localConfig = stdioConfig('local', 'node-local')
	const userConfig = stdioConfig('user', 'node-user')
	const deps = makeDependencies({
		getAllMcpConfigs: async () => ({
			servers: {
				filesystem: localConfig,
			},
			errors: [],
		}),
		getMcpConfigsByScope: (scope) => {
			switch (scope) {
				case 'local':
					return { servers: { filesystem: localConfig }, errors: [] }
				case 'user':
					return { servers: { filesystem: userConfig }, errors: [] }
				default:
					return { servers: {}, errors: [] }
			}
		},
	})

	const report = await doctorServer('filesystem', { configOnly: true }, deps)
	expect(report.servers.length).toBe(1)
	expect(report.servers[0]?.definitions.length).toBe(2)
	expect(
		report.servers[0]?.definitions.find((def) => def.sourceType === 'local')?.runtimeActive,
	).toBe(true)
	expect(
		report.servers[0]?.definitions.find((def) => def.sourceType === 'user')?.runtimeActive,
	).toBe(false)
	expect(report.servers[0]?.findings.map((finding) => finding.code).sort()).toEqual([
		'duplicate.same_name_multiple_scopes',
		'scope.shadowed',
	])
})

test('doctorServer reports project servers pending approval', async () => {
	const projectConfig = stdioConfig('project', 'node-project')
	const deps = makeDependencies({
		getMcpConfigsByScope: (scope) =>
			scope === 'project'
				? { servers: { sentry: projectConfig }, errors: [] }
				: { servers: {}, errors: [] },
		getProjectMcpServerStatus: (name) => (name === 'sentry' ? 'pending' : 'approved'),
	})

	const report = await doctorServer('sentry', { configOnly: true }, deps)
	expect(report.servers.length).toBe(1)
	expect(report.servers[0]?.definitions[0]?.pendingApproval).toBe(true)
	expect(report.servers[0]?.definitions[0]?.runtimeActive).toBe(false)
	expect(report.servers[0]?.definitions[0]?.runtimeVisible).toBe(false)
	expect(
		report.servers[0]?.findings.some(
			(finding) => finding.code === 'state.pending_project_approval',
		),
	).toBe(true)
})

test('doctorServer does not treat disabled servers as runtime-active or live-check targets', async () => {
	let connectCalls = 0
	const localConfig = stdioConfig('local', 'node-local')
	const deps = makeDependencies({
		getAllMcpConfigs: async () => ({
			servers: { github: localConfig },
			errors: [],
		}),
		getMcpConfigsByScope: (scope) =>
			scope === 'local'
				? { servers: { github: localConfig }, errors: [] }
				: { servers: {}, errors: [] },
		isMcpServerDisabled: (name) => name === 'github',
		connectToServer: async (name, config) => {
			connectCalls += 1
			return {
				name,
				type: 'failed',
				config,
				error: 'should not connect',
			}
		},
	})

	const report = await doctorServer('github', { configOnly: false }, deps)

	expect(connectCalls).toBe(0)
	expect(report.summary.blocking).toBe(0)
	expect(report.summary.warnings).toBe(1)
	expect(report.servers[0]?.definitions[0]?.disabled).toBe(true)
	expect(report.servers[0]?.definitions[0]?.runtimeActive).toBe(false)
	expect(report.servers[0]?.definitions[0]?.runtimeVisible).toBe(false)
	expect(report.servers[0]?.liveCheck.result).toBe('disabled')
	expect(
		report.servers[0]?.findings.some(
			(finding) => finding.code === 'state.disabled' && finding.severity === 'warn',
		),
	).toBe(true)
})

test('doctorAllServers skips live checks in config-only mode', async () => {
	let connectCalls = 0
	const localConfig = stdioConfig('local', 'node-local')
	const deps = makeDependencies({
		getAllMcpConfigs: async () => ({
			servers: { linear: localConfig },
			errors: [],
		}),
		getMcpConfigsByScope: (scope) =>
			scope === 'local'
				? { servers: { linear: localConfig }, errors: [] }
				: { servers: {}, errors: [] },
		connectToServer: async (name, config) => {
			connectCalls += 1
			return {
				name,
				type: 'connected',
				capabilities: {},
				config,
				cleanup: async () => {},
			}
		},
	})

	const report = await doctorAllServers({ configOnly: true }, deps)
	expect(connectCalls).toBe(0)
	expect(report.servers[0]?.liveCheck.attempted).toBe(false)
	expect(report.servers[0]?.liveCheck.result).toBe('skipped')
})

test('doctorAllServers honors scopeFilter when collecting names', async () => {
	const pluginConfig = {
		type: 'http' as const,
		url: 'https://example.test/mcp',
		scope: 'dynamic' as const,
		pluginSource: 'plugin:github@official',
	}
	const deps = makeDependencies({
		getAllMcpConfigs: async () => ({
			servers: { 'plugin:github:github': pluginConfig },
			errors: [],
		}),
	})

	const report = await doctorAllServers({ configOnly: true, scopeFilter: 'user' }, deps)

	expect(report.summary.totalReports).toBe(0)
	expect(report.servers).toEqual([])
})

test('doctorAllServers honors scopeFilter when collecting validation errors', async () => {
	const userConfig = stdioConfig('user', 'node-user')
	const deps = makeDependencies({
		getAllMcpConfigs: async () => ({
			servers: { filesystem: userConfig },
			errors: [],
		}),
		getMcpConfigsByScope: (scope) => {
			switch (scope) {
				case 'project':
					return {
						servers: {},
						errors: [
							{
								file: '.mcp.json',
								path: '',
								message: 'MCP config is not a valid JSON',
								suggestion: 'Fix the JSON syntax errors in the file',
								mcpErrorMetadata: {
									scope: 'project',
									severity: 'fatal',
								},
							},
						],
					}
				case 'user':
					return { servers: { filesystem: userConfig }, errors: [] }
				default:
					return { servers: {}, errors: [] }
			}
		},
	})

	const report = await doctorAllServers({ configOnly: true, scopeFilter: 'user' }, deps)

	expect(report.summary.totalReports).toBe(1)
	expect(report.summary.blocking).toBe(0)
	expect(report.findings).toEqual([])
	expect(report.servers[0]?.findings).toEqual([])
})

test('doctorAllServers includes observed runtime definitions for plugin-only servers', async () => {
	const pluginConfig = {
		type: 'http' as const,
		url: 'https://example.test/mcp',
		scope: 'dynamic' as const,
		pluginSource: 'plugin:github@official',
	}
	const deps = makeDependencies({
		getAllMcpConfigs: async () => ({
			servers: { 'plugin:github:github': pluginConfig },
			errors: [],
		}),
	})

	const report = await doctorAllServers({ configOnly: true }, deps)

	expect(report.summary.totalReports).toBe(1)
	expect(report.servers[0]?.definitions.length).toBe(1)
	expect(report.servers[0]?.definitions[0]?.sourceType).toBe('plugin')
	expect(report.servers[0]?.definitions[0]?.runtimeActive).toBe(true)
})

test('doctorAllServers reports disabled plugin servers as disabled, not not-found', async () => {
	const pluginConfig = {
		type: 'http' as const,
		url: 'https://example.test/mcp',
		scope: 'dynamic' as const,
		pluginSource: 'plugin:github@official',
	}
	const deps = makeDependencies({
		getAllMcpConfigs: async () => ({
			servers: { 'plugin:github:github': pluginConfig },
			errors: [],
		}),
		isMcpServerDisabled: (name) => name === 'plugin:github:github',
	})

	const report = await doctorAllServers({ configOnly: true }, deps)

	expect(report.summary.totalReports).toBe(1)
	expect(report.summary.warnings).toBe(1)
	expect(report.summary.blocking).toBe(0)
	expect(report.servers[0]?.definitions.length).toBe(1)
	expect(report.servers[0]?.definitions[0]?.sourceType).toBe('plugin')
	expect(report.servers[0]?.definitions[0]?.disabled).toBe(true)
	expect(report.servers[0]?.definitions[0]?.runtimeActive).toBe(false)
	expect(
		report.servers[0]?.findings.some(
			(finding) => finding.code === 'state.disabled' && !finding.blocking,
		),
	).toBe(true)
	expect(report.servers[0]?.findings.some((finding) => finding.code === 'state.not_found')).toBe(
		false,
	)
})

test('doctorServer converts failed live checks into blocking findings', async () => {
	const localConfig = stdioConfig('local', 'node-local')
	const deps = makeDependencies({
		getAllMcpConfigs: async () => ({
			servers: { github: localConfig },
			errors: [],
		}),
		getMcpConfigsByScope: (scope) =>
			scope === 'local'
				? { servers: { github: localConfig }, errors: [] }
				: { servers: {}, errors: [] },
		connectToServer: async (name, config) => ({
			name,
			type: 'failed',
			config,
			error: 'command not found: node-local',
		}),
	})

	const report = await doctorServer('github', { configOnly: false }, deps)

	expect(report.summary.blocking).toBe(1)
	expect(report.servers[0]?.liveCheck.result).toBe('failed')
	expect(
		report.servers[0]?.findings.some(
			(finding) => finding.code === 'stdio.command_not_found' && finding.blocking,
		),
	).toBe(true)
})

test('doctorServer converts needs-auth live checks into warning findings', async () => {
	const localConfig = stdioConfig('local', 'node-local')
	const deps = makeDependencies({
		getAllMcpConfigs: async () => ({
			servers: { sentry: localConfig },
			errors: [],
		}),
		getMcpConfigsByScope: (scope) =>
			scope === 'local'
				? { servers: { sentry: localConfig }, errors: [] }
				: { servers: {}, errors: [] },
		connectToServer: async (name, config) => ({
			name,
			type: 'needs-auth',
			config,
		}),
	})

	const report = await doctorServer('sentry', { configOnly: false }, deps)

	expect(report.summary.warnings).toBe(1)
	expect(report.summary.blocking).toBe(0)
	expect(
		report.servers[0]?.findings.some(
			(finding) => finding.code === 'auth.needs_auth' && finding.severity === 'warn',
		),
	).toBe(true)
})

test('doctorServer includes observed runtime definition for plugin-only targets', async () => {
	const pluginConfig = {
		type: 'http' as const,
		url: 'https://example.test/mcp',
		scope: 'dynamic' as const,
		pluginSource: 'plugin:github@official',
	}
	const deps = makeDependencies({
		getAllMcpConfigs: async () => ({
			servers: { 'plugin:github:github': pluginConfig },
			errors: [],
		}),
	})

	const report = await doctorServer('plugin:github:github', { configOnly: true }, deps)

	expect(report.summary.totalReports).toBe(1)
	expect(report.servers[0]?.definitions.length).toBe(1)
	expect(report.servers[0]?.definitions[0]?.sourceType).toBe('plugin')
	expect(report.servers[0]?.definitions[0]?.runtimeActive).toBe(true)
})

test('doctorServer with scopeFilter does not leak runtime definition from another scope when target is absent', async () => {
	let connectCalls = 0
	const localConfig = stdioConfig('local', 'node-local')
	const deps = makeDependencies({
		getAllMcpConfigs: async () => ({
			servers: { github: localConfig },
			errors: [],
		}),
		getMcpConfigsByScope: (scope) =>
			scope === 'local'
				? { servers: { github: localConfig }, errors: [] }
				: { servers: {}, errors: [] },
		connectToServer: async (name, config) => {
			connectCalls += 1
			return {
				name,
				type: 'connected',
				capabilities: {},
				config,
				cleanup: async () => {},
			}
		},
	})

	const report = await doctorServer('github', { configOnly: false, scopeFilter: 'user' }, deps)

	expect(connectCalls).toBe(0)
	expect(report.summary.totalReports).toBe(1)
	expect(report.summary.blocking).toBe(1)
	expect(report.servers[0]?.definitions).toEqual([])
	expect(report.servers[0]?.liveCheck.result).toBe('skipped')
	expect(
		report.servers[0]?.findings.some(
			(finding) => finding.code === 'state.not_found' && finding.blocking,
		),
	).toBe(true)
})

test('doctorServer reports blocking not-found state when no definition exists', async () => {
	const report = await doctorServer('missing-server', { configOnly: true }, makeDependencies())

	expect(report.summary.blocking).toBe(1)
	expect(
		report.servers[0]?.findings.some(
			(finding) => finding.code === 'state.not_found' && finding.blocking,
		),
	).toBe(true)
})
