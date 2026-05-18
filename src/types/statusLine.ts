// Stub file — minimal type exports to satisfy importers

export type StatusLineCommandInput = {
  session_name?: string
  model: {
    id: any
    display_name: string
  }
  workspace: {
    current_dir: string
    project_dir: string
    added_dirs: string[]
  }
  version: string
  output_style: {
    name: string
  }
  cost: {
    total_cost_usd: any
    total_duration_ms: any
    total_api_duration_ms: any
    total_lines_added: any
    total_lines_removed: any
  }
  context_window: {
    total_input_tokens: any
    total_output_tokens: any
    context_window_size: any
    current_usage: any
    used_percentage: any
    remaining_percentage: any
  }
  rate_limits: {
    five_hour?: {
      used_percentage: number
      resets_at: string
    }
    seven_day?: {
      used_percentage: number
      resets_at: string
    }
  }
  agent?: {
    name: string
  }
  remote?: {
    session_id: string
  }
  worktree?: {
    name: string
    path: string
    branch: string
    original_cwd: string
    original_branch: string
  }
  [key: string]: any
}
