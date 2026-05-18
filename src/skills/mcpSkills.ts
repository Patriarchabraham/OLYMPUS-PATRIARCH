// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Command = any

const cache = new Map<string, Promise<Command[]>>()

export const fetchMcpSkillsForClient: ((_client: any) => Promise<Command[]>) & {
  cache: typeof cache
} = Object.assign(
  async (_client: any): Promise<Command[]> => [],
  { cache },
)
