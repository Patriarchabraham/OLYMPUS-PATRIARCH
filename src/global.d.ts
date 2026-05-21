/**
 * Build-time globals replaced by the bundler at build time.
 *
 * `scripts/build.ts` substitutes these via Bun's `define` option, so at
 * runtime the references are inlined as string literals. This declaration
 * exists only to make `tsc --noEmit` aware of them — without it, every
 * `MACRO.*` access fires TS2304 "Cannot find name 'MACRO'".
 */
declare const MACRO: {
  VERSION: string
  DISPLAY_VERSION: string
  BUILD_TIME: string
  ISSUES_EXPLAINER: string
  PACKAGE_URL: string
  NATIVE_PACKAGE_URL: string | undefined
  VERSION_CHANGELOG: string
  FEEDBACK_CHANNEL: string
}

// PromiseWithResolvers polyfill for Node < 20
declare type PromiseWithResolvers<T> = {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason?: any) => void
}

// ---------------------------------------------------------------------------
// Module declarations for optional / build-time-externalized npm packages.
// These packages are either:
//   - Anthropic-internal (@ant/*) and never present in the open build
//   - Cloud SDK (@aws-sdk/*, @azure/*) pulled in by provider paths
//   - Optional native addons (audio-capture-napi, image-processor-napi, etc.)
//   - Utility libs used by features that are tree-shaken in the bundle
// The declarations let `tsc --noEmit` pass without installing every package.
// ---------------------------------------------------------------------------

declare module '@ant/claude-for-chrome-mcp' {
  export function createClaudeForChromeMcpServer(context: any): any
  export const BROWSER_TOOLS: any
}

declare module '@ant/computer-use-input' {
  const _: any
  export default _
  export type ComputerUseInput = any
  export type ComputerUseInputAPI = any
  export {}
}

declare module '@ant/computer-use-mcp' {
  const _: any
  export default _
  export const ComputerExecutor: any
  export const DisplayGeometry: any
  export const FrontmostApp: any
  export const InstalledApp: any
  export const ResolvePrepareCaptureResult: any
  export const RunningApp: any
  export const ScreenshotResult: any
  export const API_RESIZE_PARAMS: any
  export const targetImageSize: any
  export const bindSessionContext: any
  export const ComputerUseSessionContext: any
  export const CuCallToolResult: any
  export const CuPermissionRequest: any
  export const CuPermissionResponse: any
  export const DEFAULT_GRANT_FLAGS: any
  export const ScreenshotDims: any
  export function buildComputerUseTools(...args: any[]): any
  export function createComputerUseMcpServer(...args: any[]): any
  export type ComputerExecutor = any
  export type DisplayGeometry = any
  export type FrontmostApp = any
  export type InstalledApp = any
  export type ResolvePrepareCaptureResult = any
  export type RunningApp = any
  export type ScreenshotResult = any
  export type ComputerUseSessionContext = any
  export type CuCallToolResult = any
  export type CuPermissionRequest = any
  export type CuPermissionResponse = any
  export type ScreenshotDims = any
}

declare module '@ant/computer-use-mcp/sentinelApps' {
  const _: any
  export default _
  export function getSentinelCategory(...args: any[]): any
}

declare module '@ant/computer-use-mcp/types' {
  const _: any
  export default _
  export type CoordinateMode = any
  export type CuSubGates = any
  export type ComputerUseHostAdapter = any
  export type Logger = any
  export type CuPermissionRequest = any
  export type CuPermissionResponse = any
  export const DEFAULT_GRANT_FLAGS: any
}

declare module '@ant/computer-use-swift' {
  const _: any
  export default _
  export type ComputerUseAPI = any
  export {}
}

declare module '@anthropic-ai/claude-agent-sdk' {
  const _: any
  export default _
  export {}
}

declare module '@anthropic-ai/mcpb' {
  const _: any
  export default _
  export type McpbManifest = any
  export type McpbUserConfigurationOption = any
  export const McpbManifestSchema: any
  export function getMcpConfigForManifest(...args: any[]): any
  export {}
}

declare module '@aws-sdk/client-bedrock' {
  export class BedrockClient { constructor(config?: any) }
  export {}
}

declare module '@aws-sdk/client-bedrock-runtime' {
  export class BedrockRuntimeClient { constructor(config?: any) }
  export class CountTokensCommand { constructor(input?: any) }
  export type CountTokensCommandInput = any
  export {}
}

declare module '@aws-sdk/client-sts' {
  export class STSClient { constructor(config?: any) }
  export class GetCallerIdentityCommand { constructor(input?: any) }
  export {}
}

declare module '@aws-sdk/credential-providers' {
  export function fromIni(config?: any): any
  export {}
}

declare module '@azure/identity' {
  const _: any
  export default _
  export {}
}

declare module 'asciichart' {
  const _: any
  export default _
  export {}
}

declare module 'audio-capture-napi' {
  export function isNativeAudioAvailable(): boolean
  export function isNativeRecordingActive(): boolean
  export function startNativeRecording(
    onData: (data: Buffer) => void,
    onSilence?: () => void,
  ): boolean
  export function stopNativeRecording(): void
}

declare module 'cacache' {
  export function ls(cache: string, key?: string): Promise<any>
  export function rm(cache: string, key: string): Promise<any>
  export {}
}

declare module 'image-processor-napi' {
  export function getNativeModule(...args: any[]): any
  export {}
}

declare module 'plist' {
  export function parse(xml: string): any
  export function build(obj: any, opts?: any): string
}

declare module 'url-handler-napi' {
  export function waitForUrlEvent(...args: any[]): any
  export {}
}

// OpenTelemetry exporters — externalized at build time, never bundled
declare module '@opentelemetry/exporter-logs-otlp-grpc' {
  export class OTLPLogExporter { constructor(opts?: any) }
}

declare module '@opentelemetry/exporter-logs-otlp-proto' {
  export class OTLPLogExporter { constructor(opts?: any) }
}

declare module '@opentelemetry/exporter-metrics-otlp-grpc' {
  export class OTLPMetricExporter { constructor(opts?: any) }
}

declare module '@opentelemetry/exporter-metrics-otlp-http' {
  export class OTLPMetricExporter { constructor(opts?: any) }
}

declare module '@opentelemetry/exporter-metrics-otlp-proto' {
  export class OTLPMetricExporter { constructor(opts?: any) }
}

declare module '@opentelemetry/exporter-prometheus' {
  export class PrometheusExporter { constructor(opts?: any) }
}

declare module '@opentelemetry/exporter-trace-otlp-http' {
  export class OTLPTraceExporter { constructor(opts?: any) }
}

declare module '@opentelemetry/exporter-trace-otlp-proto' {
  export class OTLPTraceExporter { constructor(opts?: any) }
}

// ---------------------------------------------------------------------------
// Anthropic-internal component stubs (never rendered in open build — guarded
// by `false &&` or RUNTIME_FLAVOR checks).  Declared so tsc --noEmit passes.
// ---------------------------------------------------------------------------
declare const GateOverridesWarning: React.FC<any>
declare const ExperimentEnrollmentNotice: React.FC<any>
declare const TungstenPill: React.FC<any>
declare const Gates: React.FC<{ onOwnsEscChange: (v: boolean) => void; contentHeight: number }>
declare const UltraplanChoiceDialog: React.FC<any>
declare const UltraplanLaunchDialog: React.FC<any>
declare function launchUltraplan(opts: any): Promise<void>
declare const HOOK_TIMING_DISPLAY_THRESHOLD_MS: number

// Ant-internal model resolution (dead-code in open build)
declare function resolveAntModel(model: string): {
  model: string
  contextWindow?: number
  defaultMaxTokens?: number
  upperMaxTokensLimit?: number
} | null
declare function getAntModelOverrideConfig(): {
  defaultModel?: string
  defaultModelEffortLevel?: any
  defaultSystemPromptSuffix?: string
  antModels?: any[]
} | null

// Markdown module declarations (imported by skill content files)
declare module '*.md' {
  const content: string
  export default content
}

// Vitest query-string module declarations
declare module '*?switch-to-third-party' {
  const mod: any
  export default mod
}
declare module '*?save-bare-mode' {
  const mod: any
  export default mod
}
declare module '*?save-no-plaintext-fallback' {
  const mod: any
  export default mod
}
declare module '*?refresh-success' {
  const mod: any
  export default mod
}
declare module '*?refresh-cooldown' {
  const mod: any
  export default mod
}
declare module '*?refresh-drop-stale-api-key' {
  const mod: any
  export default mod
}
declare module '*?refresh-dedupe' {
  const mod: any
  export default mod
}
declare module '*?preserve-profile-id' {
  const mod: any
  export default mod
}
declare module '*?attach-profile-id' {
  const mod: any
  export default mod
}
declare module '*?refresh-async-read' {
  const mod: any
  export default mod
}
declare module '*?refresh-memory-cooldown' {
  const mod: any
  export default mod
}
declare module '*?codex-secure-storage' {
  const mod: any
  export default mod
}
declare module '*?codex-env-precedence' {
  const mod: any
  export default mod
}
declare module '*?codex-env-nested-account' {
  const mod: any
  export default mod
}
declare module '*?codex-auth-json-nested-account' {
  const mod: any
  export default mod
}
declare module '*?codex-secure-storage-no-auth-io' {
  const mod: any
  export default mod
}
declare module '*?codex-refresh-cooldown-fallback' {
  const mod: any
  export default mod
}
declare module '*?codex-refresh-cooldown-account-id-fallback' {
  const mod: any
  export default mod
}
declare module '*?runtime-no-sync-secure-storage' {
  const mod: any
  export default mod
}
declare module '*?hydrate=sets-token' {
  const mod: any
  export default mod
}
declare module '*?hydrate=preserve-existing' {
  const mod: any
  export default mod
}
declare module '*?read-bare-mode' {
  const mod: any
  export default mod
}
declare module '*?clear-bare-mode' {
  const mod: any
  export default mod
}

// Ink custom JSX intrinsic elements moved to src/ink-jsx.d.ts
// (must be in a module file so `declare module 'react'` augments rather than replaces @types/react)