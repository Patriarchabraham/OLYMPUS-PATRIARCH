export interface ProjectPlan {
  id: string
  title: string
  description: string
  objectives: PlanObjective[]
  milestones: PlanMilestone[]
  risks: Risk[]
  decisions: ArchitectureDecision[]
  dependencies: Dependency[]
  timeline: Timeline
  status: 'draft' | 'active' | 'completed' | 'abandoned'
  createdAt: number
  updatedAt: number
}

export interface PlanObjective {
  id: string
  title: string
  description: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  status: 'pending' | 'in_progress' | 'completed' | 'deferred'
  assignee?: string
  estimatedEffort: number
}

export interface PlanMilestone {
  id: string
  title: string
  description: string
  targetDate?: number
  completedDate?: number
  objectives: string[]
  status: 'pending' | 'in_progress' | 'completed' | 'at_risk'
}

export interface Risk {
  id: string
  title: string
  description: string
  probability: 'low' | 'medium' | 'high'
  impact: 'low' | 'medium' | 'high'
  mitigation: string
  status: 'identified' | 'monitoring' | 'mitigating' | 'resolved'
}

export interface ArchitectureDecision {
  id: string
  title: string
  context: string
  decision: string
  consequences: string[]
  alternatives: ArchitectureDecisionAlternative[]
  status: 'proposed' | 'accepted' | 'deprecated' | 'superseded'
  date: number
  author?: string
}

export interface ArchitectureDecisionAlternative {
  name: string
  description: string
  rejected: boolean
  reason: string
}

export interface Dependency {
  id: string
  from: string
  to: string
  type: 'blocks' | 'requires' | 'relates_to'
  strength: 'hard' | 'soft'
}

export interface Timeline {
  startDate: number
  endDate?: number
  phases: TimelinePhase[]
}

export interface TimelinePhase {
  name: string
  startDate: number
  endDate?: number
  milestones: string[]
}

export interface ImpactAssessment {
  change: string
  affectedFiles: string[]
  affectedModules: string[]
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  breakingChanges: string[]
  requiredTests: string[]
  estimatedEffort: number
  dependencies: string[]
}

export interface DependencyAnalysis {
  nodes: DependencyNode[]
  edges: DependencyEdge[]
  orphans: string[]
  cycles: string[][]
  hotspots: string[]
}

export interface DependencyNode {
  id: string
  type: 'file' | 'module' | 'package'
  name: string
  path: string
  inDegree: number
  outDegree: number
}

export interface DependencyEdge {
  source: string
  target: string
  type: 'import' | 'require' | 'reference'
}
