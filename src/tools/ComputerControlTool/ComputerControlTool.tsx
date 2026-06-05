import type { ToolResultBlockParam } from '@anthropic-ai/sdk/resources/index.mjs'
import * as React from 'react'
import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import { isEnvTruthy } from '../../utils/envUtils.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { captureScreen } from './screenCapture.js'
import { mouseClick, mouseDoubleClick, typeText, pressKey, scroll, drag } from './inputSimulation.js'
import { getAccessibilityTree } from './accessibility.js'
import { COMPUTER_CONTROL_TOOL_NAME, getPrompt } from './prompt.js'

/** Environment variable to enable the ComputerControl tool. */
const ENV_COMPUTER_CONTROL_ENABLED = 'OLYMPUZ_COMPUTER_CONTROL'

// ---------- Input schema ----------

const fullInputSchema = lazySchema(() =>
  z.strictObject({
    action: z.enum([
      'screenshot',
      'click',
      'double_click',
      'type',
      'key_press',
      'scroll',
      'drag',
      'get_accessibility_tree',
    ]).describe('The desktop automation action to perform'),
    x: z.number().optional().describe('X coordinate in pixels (for click, double_click, scroll, drag)'),
    y: z.number().optional().describe('Y coordinate in pixels (for click, double_click, scroll, drag)'),
    text: z.string().optional().describe('Text to type (for type action)'),
    key: z.string().optional().describe('Key or key combination, e.g. "ctrl+c" (for key_press action)'),
    direction: z.enum(['up', 'down']).optional().describe('Scroll direction (for scroll action)'),
    amount: z.number().optional().describe('Scroll amount in ticks (for scroll action)'),
    x2: z.number().optional().describe('End X coordinate (for drag action)'),
    y2: z.number().optional().describe('End Y coordinate (for drag action)'),
  }),
)

type InputSchema = ReturnType<typeof fullInputSchema>

// ---------- Output schema ----------

const outputSchema = lazySchema(() =>
  z.object({
    success: z.boolean().describe('Whether the action succeeded'),
    message: z.string().optional().describe('Human-readable result message'),
    imageBase64: z.string().optional().describe('Base64-encoded PNG screenshot (screenshot action only)'),
    accessibilityTree: z.string().optional().describe('Accessibility tree text (get_accessibility_tree action only)'),
    error: z.string().optional().describe('Error message if action failed'),
  }),
)

type OutputSchema = ReturnType<typeof outputSchema>
export type ComputerControlOutput = z.infer<OutputSchema>

// ---------- Tool definition ----------

export const ComputerControlTool = buildTool({
  name: COMPUTER_CONTROL_TOOL_NAME,
  searchHint: 'desktop automation screenshot click type',
  maxResultSizeChars: 200_000,
  get inputSchema(): InputSchema {
    return fullInputSchema()
  },
  get outputSchema(): OutputSchema {
    return outputSchema()
  },

  isEnabled() {
    return isEnvTruthy(process.env[ENV_COMPUTER_CONTROL_ENABLED])
  },

  isConcurrencySafe() {
    return false
  },

  isReadOnly(input) {
    return input.action === 'screenshot' || input.action === 'get_accessibility_tree'
  },

  toAutoClassifierInput(input) {
    return `ComputerControl(${input.action})`
  },

  userFacingName(input) {
    if (!input?.action) return 'ComputerControl'
    const actionNames: Record<string, string> = {
      screenshot: 'Screenshot',
      click: 'Click',
      double_click: 'DoubleClick',
      type: 'Type',
      key_press: 'KeyPress',
      scroll: 'Scroll',
      drag: 'Drag',
      get_accessibility_tree: 'AccessibilityTree',
    }
    return actionNames[input.action] ?? 'ComputerControl'
  },

  getToolUseSummary(input) {
    if (!input?.action) return null
    return `ComputerControl: ${input.action}`
  },

  getActivityDescription(input) {
    if (!input?.action) return 'Controlling desktop'
    const action = input.action
    switch (action) {
      case 'screenshot': return 'Capturing screenshot'
      case 'click': return `Clicking at (${input.x}, ${input.y})`
      case 'double_click': return `Double-clicking at (${input.x}, ${input.y})`
      case 'type': return 'Typing text'
      case 'key_press': return `Pressing ${input.key ?? 'key'}`
      case 'scroll': return `Scrolling ${input.direction ?? ''}`
      case 'drag': return `Dragging from (${input.x}, ${input.y}) to (${input.x2}, ${input.y2})`
      case 'get_accessibility_tree': return 'Reading accessibility tree'
      default: return 'Controlling desktop'
    }
  },

  async description(input) {
    return `Desktop automation: ${input.action ?? 'unknown action'}`
  },

  async prompt() {
    return getPrompt()
  },

  renderToolUseMessage(
    input: Partial<{ action: string; x: number; y: number; text: string; key: string }>,
    { verbose }: { theme?: string; verbose: boolean },
  ): React.ReactNode {
    if (!input?.action) return null
    if (verbose) {
      const parts = [`action: ${input.action}`]
      if (input.x !== undefined) parts.push(`x: ${input.x}`)
      if (input.y !== undefined) parts.push(`y: ${input.y}`)
      if (input.text) parts.push(`text: "${input.text}"`)
      if (input.key) parts.push(`key: "${input.key}"`)
      return parts.join(', ')
    }
    return `${input.action}${input.x !== undefined ? ` (${input.x}, ${input.y})` : ''}`
  },

  async call(input) {
    try {
      switch (input.action) {
        case 'screenshot': {
          const pngBuffer = await captureScreen()
          const base64 = pngBuffer.toString('base64')
          return {
            data: {
              success: true,
              message: `Screenshot captured (${pngBuffer.length} bytes, ${Math.round(pngBuffer.length / 1024)}KB)`,
              imageBase64: base64,
            },
          }
        }

        case 'click': {
          if (input.x === undefined || input.y === undefined) {
            return {
              data: {
                success: false,
                error: 'click action requires x and y coordinates',
              },
            }
          }
          await mouseClick(input.x, input.y)
          return {
            data: {
              success: true,
              message: `Clicked at (${input.x}, ${input.y})`,
            },
          }
        }

        case 'double_click': {
          if (input.x === undefined || input.y === undefined) {
            return {
              data: {
                success: false,
                error: 'double_click action requires x and y coordinates',
              },
            }
          }
          await mouseDoubleClick(input.x, input.y)
          return {
            data: {
              success: true,
              message: `Double-clicked at (${input.x}, ${input.y})`,
            },
          }
        }

        case 'type': {
          if (!input.text) {
            return {
              data: {
                success: false,
                error: 'type action requires text parameter',
              },
            }
          }
          await typeText(input.text)
          return {
            data: {
              success: true,
              message: `Typed text (${input.text.length} characters)`,
            },
          }
        }

        case 'key_press': {
          if (!input.key) {
            return {
              data: {
                success: false,
                error: 'key_press action requires key parameter',
              },
            }
          }
          await pressKey(input.key)
          return {
            data: {
              success: true,
              message: `Pressed key: ${input.key}`,
            },
          }
        }

        case 'scroll': {
          if (input.x === undefined || input.y === undefined) {
            return {
              data: {
                success: false,
                error: 'scroll action requires x and y coordinates',
              },
            }
          }
          if (!input.direction) {
            return {
              data: {
                success: false,
                error: 'scroll action requires direction (up or down)',
              },
            }
          }
          const scrollAmount = input.amount ?? 3
          await scroll(input.x, input.y, input.direction, scrollAmount)
          return {
            data: {
              success: true,
              message: `Scrolled ${input.direction} by ${scrollAmount} at (${input.x}, ${input.y})`,
            },
          }
        }

        case 'drag': {
          if (
            input.x === undefined || input.y === undefined ||
            input.x2 === undefined || input.y2 === undefined
          ) {
            return {
              data: {
                success: false,
                error: 'drag action requires x, y, x2, y2 coordinates',
              },
            }
          }
          await drag(input.x, input.y, input.x2, input.y2)
          return {
            data: {
              success: true,
              message: `Dragged from (${input.x}, ${input.y}) to (${input.x2}, ${input.y2})`,
            },
          }
        }

        case 'get_accessibility_tree': {
          const tree = await getAccessibilityTree()
          return {
            data: {
              success: true,
              message: 'Accessibility tree retrieved',
              accessibilityTree: tree,
            },
          }
        }

        default:
          return {
            data: {
              success: false,
              error: `Unknown action: ${input.action}`,
            },
          }
      }
    } catch (err) {
      return {
        data: {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        },
      }
    }
  },

  mapToolResultToToolResultBlockParam(
    output: ComputerControlOutput,
    toolUseID: string,
  ): ToolResultBlockParam {
    // For screenshots, return an image content block for multimodal models
    if (output.imageBase64) {
      return {
        tool_use_id: toolUseID,
        type: 'tool_result',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: output.imageBase64,
            },
          },
          ...(output.message ? [{ type: 'text' as const, text: output.message }] : []),
        ],
      }
    }

    // For accessibility tree
    if (output.accessibilityTree) {
      return {
        tool_use_id: toolUseID,
        type: 'tool_result',
        content: output.accessibilityTree,
      }
    }

    // For other actions or errors
    const content = output.error
      ? `Error: ${output.error}`
      : output.message ?? (output.success ? 'Action completed' : 'Action failed')

    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      content,
      is_error: !output.success,
    }
  },

  extractSearchText(output: ComputerControlOutput) {
    if (output.accessibilityTree) return output.accessibilityTree
    return output.message ?? ''
  },
} satisfies ToolDef<InputSchema, ComputerControlOutput>)
