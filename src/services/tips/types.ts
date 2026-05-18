export interface Tip {
  id: string
  title?: string
  content: (context?: TipContext) => Promise<string>
  category?: string
  cooldownSessions?: number
  isRelevant?: () => Promise<boolean>
}
export interface TipContext {
  command?: string
  model?: string
  [key: string]: any
}
