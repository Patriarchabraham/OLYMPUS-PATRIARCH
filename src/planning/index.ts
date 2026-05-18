// Planning and strategy system — public API

export type {
  ProjectPlan,
  PlanObjective,
  PlanMilestone,
  Risk,
  ArchitectureDecision,
  ArchitectureDecisionAlternative,
  Dependency,
  Timeline,
  TimelinePhase,
  ImpactAssessment,
  DependencyAnalysis,
  DependencyNode,
  DependencyEdge,
} from './types.js'

export {
  createPlan,
  getPlan,
  listPlans,
  addObjective,
  addMilestone,
  addDependency,
  addPhase,
  updatePlanStatus,
  generatePlanFromDescription,
  assessProgress,
  suggestNextSteps,
  exportPlan,
  importPlan,
  clearPlans,
} from './projectPlanner.js'

export {
  setDataDir as setADRDataDir,
  createADR,
  addAlternative,
  addConsequence,
  acceptDecision,
  deprecateDecision,
  getDecision,
  listDecisions,
  exportADRs,
  importADRs,
  persistADRs,
  loadADRs,
  clearDecisions,
} from './architectureDecisions.js'

export {
  calculateRiskScore,
  assessRisk,
  assessImpact,
  prioritizeRisks,
  generateMitigationPlan,
} from './riskAssessment.js'

export {
  analyzeDependencies,
  detectCircularDependencies,
  findImportChain,
  findHotspots,
  calculateCoupling,
  visualizeDependencyGraph,
} from './dependencyAnalyzer.js'
