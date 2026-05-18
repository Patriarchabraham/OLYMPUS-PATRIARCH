import { DEVICE_BRIDGE_TOOL_NAME } from './constants.js'

export { DEVICE_BRIDGE_TOOL_NAME }

export function getPrompt(): string {
  return `Universal device discovery and control tool. Discover, inspect, and interact with connected devices — local PC, Android phones/tablets, iOS devices, and remote PCs.

## Available actions

- **scan** - Discover devices on the local network (arp), USB (adb), and optionally Bluetooth. Use \`scanNetwork\` and \`scanUSB\` to control which scans run.
- **list** - List all previously discovered devices with their status and capabilities.
- **info** - Get detailed hardware/software information about the local machine or a specific device. If \`deviceId\` is provided, returns that device's info; otherwise returns the full local device snapshot (CPU, RAM, GPU, disks, network, peripherals, processes, services, installed software).
- **screenshot** - Take a screenshot from an Android device. Requires \`deviceId\` of an Android device.
- **execute** - Run a shell command on a remote device. Requires \`deviceId\` and \`command\`.
- **apps** - List installed third-party apps on an Android device. Requires \`deviceId\` of an Android device.
- **push** - Upload a file to an Android device. Requires \`deviceId\`, \`localPath\`, and \`remotePath\`.
- **pull** - Download a file from an Android device. Requires \`deviceId\`, \`remotePath\`, and \`localPath\`.

## Parameters

- \`action\` (required) — One of: scan, list, info, screenshot, execute, apps, push, pull
- \`deviceId\` (optional) — Target device ID (from scan/list results)
- \`command\` (optional) — Shell command to execute on the device (for \`execute\` action)
- \`localPath\` (optional) — Local file path (for push/pull)
- \`remotePath\` (optional) — Remote file path on device (for push/pull)
- \`scanNetwork\` (optional, default true) — Include network device scanning
- \`scanUSB\` (optional, default true) — Include USB device scanning (ADB)

## Usage tips

1. Run \`scan\` first to discover available devices.
2. Use \`info\` without a deviceId to understand the local machine's capabilities.
3. For Android: ensure ADB is installed and USB debugging is enabled on the device.
4. Screenshots from Android devices are returned as base64-encoded PNG images.

## Safety

- Always verify the target device before executing commands.
- Be cautious with \`execute\` — commands run directly on the target device.
- File transfers (push/pull) overwrite existing files without confirmation.`
}
