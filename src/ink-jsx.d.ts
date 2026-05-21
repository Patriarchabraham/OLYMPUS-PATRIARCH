// Ink JSX augmentation for react-jsx mode.
// This file IS a module (has an import), so `declare module 'react'` below
// is treated as an augmentation (merged with @types/react) rather than a
// replacement that shadows the real types.
import type {} from 'react'

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'ink-box': any
      'ink-text': any
      'ink-link': any
      'ink-raw-ansi': any
      'ink-root': any
      'ink-virtual-text': any
      'ink-newline': any
    }
  }
}
