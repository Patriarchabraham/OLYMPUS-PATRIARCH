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
  const _: any
  export default _
  export {}
}

declare module '@ant/computer-use-input' {
  const _: any
  export default _
  export {}
}

declare module '@ant/computer-use-mcp' {
  const _: any
  export default _
  export {}
}

declare module '@ant/computer-use-mcp/sentinelApps' {
  const _: any
  export default _
  export {}
}

declare module '@ant/computer-use-mcp/types' {
  const _: any
  export default _
  export {}
}

declare module '@ant/computer-use-swift' {
  const _: any
  export default _
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
  export {}
}

declare module '@aws-sdk/client-bedrock' {
  const _: any
  export default _
  export {}
}

declare module '@aws-sdk/client-bedrock-runtime' {
  const _: any
  export default _
  export {}
}

declare module '@aws-sdk/client-sts' {
  const _: any
  export default _
  export {}
}

declare module '@aws-sdk/credential-providers' {
  const _: any
  export default _
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
  const _: any
  export default _
  export {}
}

declare module 'cacache' {
  const _: any
  export default _
  export {}
}

declare module 'image-processor-napi' {
  const _: any
  export default _
  export {}
}

declare module 'plist' {
  export function parse(xml: string): any
  export function build(obj: any, opts?: any): string
}

declare module 'url-handler-napi' {
  const _: any
  export default _
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
