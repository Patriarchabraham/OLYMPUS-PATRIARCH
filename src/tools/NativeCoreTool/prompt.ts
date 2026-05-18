export const NATIVE_CORE_TOOL_NAME = 'NativeCore' as const

export function getPrompt(): string {
  return `Native system performance and inspection tool. Provides deep access to the local machine's hardware, DLLs, and performance characteristics.

## Available actions

- **inspect_dll** - Inspect a DLL file for its exports, imports, version, architecture, and digital signature. Requires \`path\`.
- **list_dlls** - List DLL files in a directory (defaults to System32). Optional \`directory\` parameter.
- **system_profile** - Get a full system profile: CPU topology, memory layout, NUMA nodes, GPUs, disks, network, peripherals, running processes, and services.
- **performance** - Get performance metrics including cache hit rates, average latencies, and bottleneck analysis.
- **optimize** - Analyze running processes and suggest optimizations (priority, affinity, memory).

## Parameters

- \`action\` (required): One of the actions listed above.
- \`path\` (optional): File path for inspect_dll action.
- \`directory\` (optional): Directory path for list_dlls action. Defaults to C:\\\\Windows\\\\System32 on Windows.

## Usage patterns

1. Use \`system_profile\` to understand the hardware environment before making optimization decisions.
2. Use \`inspect_dll\` to analyze DLL dependencies and verify digital signatures.
3. Use \`performance\` to identify bottlenecks in the native call bridge.
4. Use \`optimize\` to get process-level optimization suggestions.

## Platform support

- Windows: Full support via persistent PowerShell bridge (WMI, .NET reflection).
- macOS/Linux: Partial support via Node.js \`os\` module fallbacks.

## Notes

- All actions are read-only and do not modify the system.
- Results are cached aggressively for performance (30s default TTL).
- The persistent PowerShell session provides <5ms latency for cached queries.`
}
