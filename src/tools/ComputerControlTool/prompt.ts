export const COMPUTER_CONTROL_TOOL_NAME = 'ComputerControl' as const

export function getPrompt(): string {
  return `Desktop automation tool for controlling the user's computer. Capable of taking screenshots, simulating mouse and keyboard input, scrolling, dragging, and inspecting accessibility trees.

## Available actions

- **screenshot** - Capture the screen and return a base64-encoded PNG image. No coordinates needed.
- **click** - Left-click at coordinates (x, y). Requires \`x\` and \`y\`.
- **double_click** - Double-click at coordinates (x, y). Requires \`x\` and \`y\`.
- **type** - Type a text string at the current cursor position. Requires \`text\`.
- **key_press** - Press a key or key combination (e.g. "ctrl+c", "alt+tab", "enter", "escape"). Requires \`key\`.
- **scroll** - Scroll at a position. Requires \`x\`, \`y\`, \`direction\` ("up" or "down"), and \`amount\` (number of scroll ticks).
- **drag** - Drag from (x1,y1) to (x2,y2). Requires \`x\`, \`y\`, \`x2\`, \`y2\`.
- **get_accessibility_tree** - Get the accessibility tree of the active window as structured text. No coordinates needed.

## Coordinate system

- Origin (0,0) is the top-left corner of the primary display.
- Coordinates are in pixels.
- Use \`screenshot\` first to understand the layout before clicking or interacting.

## Usage pattern

1. Take a screenshot to see the current screen state.
2. Identify the target element and its coordinates.
3. Perform the desired action (click, type, scroll, etc.).
4. Take another screenshot to verify the result.

## Tips

- For typing into a specific field, first click on it, then use \`type\`.
- For keyboard shortcuts, use \`key_press\` with "+" separated keys (e.g. "ctrl+shift+s").
- For scrolling long pages, use \`scroll\` with appropriate direction and amount.
- If an action doesn't produce the expected result, take a screenshot to diagnose.

## Safety

- This tool directly controls the user's desktop. Always verify with a screenshot before performing destructive actions.
- Avoid clicking randomly — always identify coordinates from a screenshot first.
- Be careful with keyboard shortcuts that may close windows or delete data.`
}
