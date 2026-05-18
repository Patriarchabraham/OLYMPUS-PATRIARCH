export type Workflow = 'claude' | 'claude-review'

export type Warning = {
  title: string
  description?: string
  message?: string
  instructions?: string[]
}

export type AuthType = 'api_key' | 'oauth' | 'oauth_token'

export type WorkflowAction = 'create' | 'skip' | 'update'

export type InstallStep =
  | 'check-gh'
  | 'choose-repo'
  | 'install-app'
  | 'check-existing-secret'
  | 'api-key'
  | 'warnings'
  | 'existing-workflow'
  | 'creating'
  | 'success'
  | 'error'
  | 'oauth'
  | 'oauth-flow'
  | 'check-existing-workflow'
  | 'select-workflows'

export type State = {
  step: InstallStep
  selectedRepoName: string
  currentRepo: string
  useCurrentRepo: boolean
  apiKeyOrOAuthToken: string
  useExistingKey: boolean
  currentWorkflowInstallStep: number
  warnings: Warning[]
  secretExists: boolean
  secretName: string
  useExistingSecret: boolean
  workflowExists: boolean
  selectedWorkflows: Workflow[]
  selectedApiKeyOption: 'existing' | 'new' | 'oauth'
  authType: AuthType
  workflowAction?: WorkflowAction
  error?: string
  errorReason?: string
  errorInstructions?: string[]
}
