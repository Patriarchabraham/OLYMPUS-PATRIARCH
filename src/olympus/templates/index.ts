/**
 * Industry Templates — 17 pre-built company templates.
 * Each template defines departments, agent roles, workflows, and KPIs.
 * Migrated from /c/olympus-industries/src/factory/templates/index.ts
 */

import type { IndustryTemplate } from '../types.js'

/**
 * Compact template builder. Converts shorthand notation to full IndustryTemplate.
 */
function mk(
	slug: string,
	depts: Array<{
		n: string
		t: string
		a: Array<{ n: string; r: string; c: string[]; w?: number }>
	}>,
): IndustryTemplate {
	return {
		segmentId: slug,
		departments: depts.map((d) => ({
			name: d.n,
			type: d.t as 'core' | 'support' | 'executive',
			agents: d.a.map((a) => ({
				name: a.n,
				role: a.r,
				agentType: a.w && a.w > 1.5 ? ('manager' as const) : ('worker' as const),
				capabilities: a.c,
				expertiseWeight: a.w ?? 1.0,
			})),
		})),
		workflows: [],
		kpis: ['efficiency', 'quality', 'satisfaction', 'revenue'],
	}
}

/** All 17 industry templates indexed by segment slug */
export const COMPANY_TEMPLATES: Record<string, IndustryTemplate> = {
	legal: mk('legal', [
		{ n: 'Corporate Law', t: 'core', a: [{ n: 'Ana Silva', r: 'Senior Legal Advisor', c: ['contract_review', 'corporate_governance', 'mergers_acquisitions'], w: 1.9 }, { n: 'Carlos Mendes', r: 'Legal Researcher', c: ['case_law_research', 'statute_analysis'] }, { n: 'Marina Costa', r: 'Contract Drafter', c: ['contract_drafting', 'clause_negotiation', 'risk_assessment'] }] },
		{ n: 'Litigation', t: 'core', a: [{ n: 'Pedro Almeida', r: 'Litigation Strategist', c: ['trial_strategy', 'deposition_planning', 'evidence_analysis'], w: 1.7 }, { n: 'Sofia Ferreira', r: 'Paralegal', c: ['document_management', 'filing_preparation'] }] },
		{ n: 'Compliance', t: 'support', a: [{ n: 'Ricardo Santos', r: 'Compliance Officer', c: ['regulatory_monitoring', 'audit_preparation', 'policy_drafting'], w: 1.6 }] },
		{ n: 'IP', t: 'support', a: [{ n: 'Beatriz Lima', r: 'IP Specialist', c: ['trademark_filing', 'patent_analysis'] }] },
	]),
	healthcare: mk('healthcare', [
		{ n: 'Clinical', t: 'core', a: [{ n: 'Dra. Helena', r: 'Chief Medical Officer', c: ['diagnosis_support', 'treatment_planning'], w: 2.0 }, { n: 'Dr. Marcos', r: 'Medical AI', c: ['symptom_analysis', 'drug_interaction_check'] }, { n: 'Enf. Lucia', r: 'Nurse Coordinator', c: ['patient_care', 'medication_management'], w: 1.6 }] },
		{ n: 'Administration', t: 'support', a: [{ n: 'Fernando G.', r: 'Administrator', c: ['scheduling', 'resource_allocation', 'billing'], w: 1.5 }] },
		{ n: 'Pharmacy', t: 'support', a: [{ n: 'Dr. Rui', r: 'Pharmacist AI', c: ['prescription_validation', 'inventory_management'] }] },
		{ n: 'Research', t: 'core', a: [{ n: 'Dra. Ines', r: 'Research Coordinator', c: ['clinical_trials', 'data_analysis'] }] },
	]),
	finance: mk('finance', [
		{ n: 'Investment Banking', t: 'core', a: [{ n: 'Alexander Morgan', r: 'Senior Investment Advisor', c: ['portfolio_management', 'risk_assessment', 'market_analysis'], w: 2.0 }, { n: 'Victoria Chen', r: 'Financial Analyst', c: ['financial_modeling', 'valuation', 'due_diligence'] }] },
		{ n: 'Risk Management', t: 'core', a: [{ n: 'Hugo Santos', r: 'Risk Analyst', c: ['credit_risk', 'market_risk'], w: 1.7 }] },
		{ n: 'Compliance', t: 'support', a: [{ n: 'Clara Mendez', r: 'Compliance Auditor', c: ['regulatory_compliance', 'aml_checking'] }] },
		{ n: 'Trading', t: 'core', a: [{ n: 'Daniel Park', r: 'Trading Analyst', c: ['algorithmic_trading', 'market_monitoring'] }] },
	]),
	tech: mk('tech', [
		{ n: 'Engineering', t: 'core', a: [{ n: 'Raj Patel', r: 'Senior Developer', c: ['architecture_design', 'code_review', 'system_scaling'], w: 1.9 }, { n: 'Yuki Tanaka', r: 'Full-Stack Developer', c: ['frontend', 'backend_api', 'database_design'] }, { n: 'Omar Hassan', r: 'DevOps Engineer', c: ['ci_cd', 'cloud_infrastructure', 'monitoring'] }] },
		{ n: 'Product', t: 'core', a: [{ n: 'Emma Wilson', r: 'Product Manager', c: ['roadmap_planning', 'user_research', 'feature_prioritization'], w: 1.7 }] },
		{ n: 'Design', t: 'support', a: [{ n: 'Lucia Moretti', r: 'UX Designer', c: ['wireframing', 'prototyping', 'user_testing'] }] },
		{ n: 'QA', t: 'support', a: [{ n: 'Kim Lee', r: 'QA Engineer', c: ['test_automation', 'regression_testing'] }] },
	]),
	retail: mk('retail', [
		{ n: 'Sales', t: 'core', a: [{ n: 'Maria Santos', r: 'Sales Director', c: ['revenue_optimization', 'team_management'], w: 1.8 }, { n: 'Joao Oliveira', r: 'Sales Representative', c: ['product_knowledge', 'negotiation'] }] },
		{ n: 'Marketing', t: 'core', a: [{ n: 'Ana Torres', r: 'Digital Marketing', c: ['seo', 'social_media', 'email_campaigns'] }] },
		{ n: 'Inventory', t: 'support', a: [{ n: 'Pedro Costa', r: 'Inventory Analyst', c: ['stock_management', 'demand_forecasting'] }] },
		{ n: 'Customer Service', t: 'support', a: [{ n: 'Laura Dias', r: 'Customer Experience', c: ['complaint_resolution', 'feedback_analysis'] }] },
	]),
	realestate: mk('realestate', [
		{ n: 'Sales', t: 'core', a: [{ n: 'Ricardo Lima', r: 'Property Advisor', c: ['property_valuation', 'market_analysis'], w: 1.7 }, { n: 'Sandra Rocha', r: 'Real Estate Agent', c: ['property_showing', 'negotiation'] }] },
		{ n: 'Property Management', t: 'core', a: [{ n: 'Tiago Ferreira', r: 'Property Manager', c: ['tenant_management', 'maintenance'] }] },
		{ n: 'Legal', t: 'support', a: [{ n: 'Diana Sousa', r: 'Legal Advisor', c: ['title_search', 'contract_review'] }] },
	]),
	education: mk('education', [
		{ n: 'Academic', t: 'core', a: [{ n: 'Prof. Antonio', r: 'Academic Director', c: ['curriculum_design', 'faculty_management'], w: 1.8 }, { n: 'Dra. Clara', r: 'Professor AI', c: ['lesson_planning', 'student_assessment'] }] },
		{ n: 'Student Affairs', t: 'support', a: [{ n: 'Rita Almeida', r: 'Student Advisor', c: ['enrollment', 'counseling', 'career_guidance'] }] },
		{ n: 'Research', t: 'core', a: [{ n: 'Dr. Paulo', r: 'Research Coordinator', c: ['grant_writing', 'publication_support'] }] },
	]),
	marketing: mk('marketing', [
		{ n: 'Creative', t: 'core', a: [{ n: 'Leo Brandao', r: 'Creative Director', c: ['brand_strategy', 'campaign_design'], w: 1.9 }, { n: 'Nina Costa', r: 'Content Writer', c: ['copywriting', 'blog_content', 'social_media'] }] },
		{ n: 'Digital', t: 'core', a: [{ n: 'Bruno Alves', r: 'SEO Specialist', c: ['keyword_research', 'technical_seo'] }] },
		{ n: 'Analytics', t: 'support', a: [{ n: 'Camila Santos', r: 'Data Analyst', c: ['campaign_analytics', 'a_b_testing'] }] },
	]),
	consulting: mk('consulting', [
		{ n: 'Strategy', t: 'core', a: [{ n: 'Dr. Felipe', r: 'Senior Consultant', c: ['strategic_planning', 'market_analysis'], w: 2.0 }, { n: 'Isabel Monteiro', r: 'Business Analyst', c: ['data_analysis', 'process_mapping'] }] },
		{ n: 'Operations', t: 'core', a: [{ n: 'Gustavo R.', r: 'Ops Consultant', c: ['lean_methodology', 'supply_chain'] }] },
		{ n: 'Technology', t: 'support', a: [{ n: 'Tatiana F.', r: 'Tech Consultant', c: ['digital_transformation', 'it_strategy'] }] },
	]),
	manufacturing: mk('manufacturing', [
		{ n: 'Production', t: 'core', a: [{ n: 'Roberto Machado', r: 'Production Manager', c: ['production_planning', 'quality_control'], w: 1.8 }, { n: 'Ana Beatriz', r: 'Line Supervisor', c: ['assembly_management', 'safety_compliance'] }] },
		{ n: 'Quality', t: 'core', a: [{ n: 'Carlos Eduardo', r: 'Quality Inspector', c: ['quality_assurance', 'iso_compliance'] }] },
		{ n: 'Supply Chain', t: 'support', a: [{ n: 'Marcia Oliveira', r: 'Supply Chain Analyst', c: ['procurement', 'logistics_coordination'] }] },
	]),
	logistics: mk('logistics', [
		{ n: 'Operations', t: 'core', a: [{ n: 'Fernando Dias', r: 'Operations Director', c: ['route_optimization', 'fleet_management'], w: 1.8 }] },
		{ n: 'Fleet', t: 'core', a: [{ n: 'Rui Santos', r: 'Fleet Coordinator', c: ['vehicle_tracking', 'maintenance_scheduling'] }] },
		{ n: 'Warehouse', t: 'support', a: [{ n: 'Patricia Lima', r: 'Warehouse Manager', c: ['inventory_control', 'space_management'] }] },
	]),
	tourism: mk('tourism', [
		{ n: 'Operations', t: 'core', a: [{ n: 'Catarina Sousa', r: 'Operations Manager', c: ['booking_management', 'itinerary_planning'], w: 1.7 }] },
		{ n: 'Guest Services', t: 'core', a: [{ n: 'Andre Costa', r: 'Experience Designer', c: ['experience_curation', 'feedback_management'] }] },
		{ n: 'Revenue', t: 'support', a: [{ n: 'Mariana Reis', r: 'Revenue Manager', c: ['pricing_strategy', 'demand_forecasting'] }] },
	]),
	food: mk('food', [
		{ n: 'Kitchen', t: 'core', a: [{ n: 'Chef Rodrigo', r: 'Executive Chef AI', c: ['menu_design', 'recipe_creation', 'food_safety'], w: 1.9 }, { n: 'Sommelier Luis', r: 'Wine Expert', c: ['wine_pairing', 'beverage_program'] }] },
		{ n: 'Service', t: 'core', a: [{ n: 'Daniela Martins', r: 'Service Manager', c: ['table_management', 'staff_training'] }] },
		{ n: 'Supply', t: 'support', a: [{ n: 'Hugo Pereira', r: 'Supply Manager', c: ['ingredient_sourcing', 'cost_control'] }] },
	]),
	energy: mk('energy', [
		{ n: 'Generation', t: 'core', a: [{ n: 'Dr. Nuno', r: 'Energy Analyst', c: ['power_generation', 'renewable_optimization'], w: 1.8 }] },
		{ n: 'Distribution', t: 'core', a: [{ n: 'Sara Teixeira', r: 'Grid Operator', c: ['load_balancing', 'fault_detection'] }] },
		{ n: 'Safety', t: 'support', a: [{ n: 'Miguel Santos', r: 'Safety Inspector', c: ['hazard_assessment', 'compliance_auditing'] }] },
	]),
	entertainment: mk('entertainment', [
		{ n: 'Production', t: 'core', a: [{ n: 'Director AI', r: 'Creative Producer', c: ['content_production', 'talent_coordination'], w: 1.9 }] },
		{ n: 'Talent', t: 'core', a: [{ n: 'Talent Scout', r: 'Acquisition Lead', c: ['casting', 'contract_negotiation'] }] },
		{ n: 'Distribution', t: 'support', a: [{ n: 'Marketing Director', r: 'Distribution Strategist', c: ['platform_strategy', 'audience_targeting'] }] },
	]),
	government: mk('government', [
		{ n: 'Policy', t: 'core', a: [{ n: 'Policy Analyst', r: 'Senior Policy Advisor', c: ['policy_research', 'impact_assessment'], w: 1.8 }] },
		{ n: 'Services', t: 'core', a: [{ n: 'Service Manager', r: 'Public Service Coordinator', c: ['citizen_services', 'process_optimization'] }] },
		{ n: 'IT', t: 'support', a: [{ n: 'IT Director', r: 'Government IT Lead', c: ['digital_transformation', 'cybersecurity'] }] },
	]),
	ngo: mk('ngo', [
		{ n: 'Programs', t: 'core', a: [{ n: 'Program Manager', r: 'Program Director', c: ['program_design', 'impact_measurement'], w: 1.8 }] },
		{ n: 'Fundraising', t: 'core', a: [{ n: 'Fundraiser Lead', r: 'Fundraising Coordinator', c: ['grant_writing', 'donor_management'] }] },
		{ n: 'Communications', t: 'support', a: [{ n: 'Comms Lead', r: 'Communications Manager', c: ['storytelling', 'social_media', 'media_relations'] }] },
	]),
}

/** Get list of all available template slugs */
export function getTemplateSlugs(): string[] {
	return Object.keys(COMPANY_TEMPLATES)
}

/** Get a specific template by slug */
export function getTemplate(slug: string): IndustryTemplate | undefined {
	return COMPANY_TEMPLATES[slug]
}
