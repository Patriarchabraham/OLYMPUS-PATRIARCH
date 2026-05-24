import { describe, expect, it } from 'vitest'
import type { ReasoningChain } from '../reasoning/types.js'
import { SessionContextManager } from './sessionContext.js'

function makeChain(query: string, confidence = 0.8): ReasoningChain {
	return {
		id: `chain-${Date.now()}-${Math.random()}`,
		strategy: 'cot',
		query,
		steps: [{ id: '1', type: 'analysis', content: `Analyzing ${query}`, confidence }],
		conclusion: `Result for ${query}`,
		confidence,
		durationMs: 100,
		timestamp: Date.now(),
	}
}

describe('SessionContextManager', () => {
	it('creates session on first access', () => {
		const mgr = new SessionContextManager()
		const session = mgr.getSession('test-session')
		expect(session.sessionId).toBe('test-session')
		expect(session.chains).toEqual([])
	})

	it('updates from chain', () => {
		const mgr = new SessionContextManager()
		const chain = makeChain('analyze code quality')
		mgr.updateFromChain(chain, 'test-session')
		const session = mgr.getSession('test-session')
		expect(session.chains.length).toBe(1)
	})

	it('builds context string', () => {
		const mgr = new SessionContextManager()
		mgr.updateFromChain(makeChain('test query'), 'test-session')
		const ctx = mgr.buildContextString('test-session')
		expect(ctx).toContain('previous reasoning chains')
	})

	it('detects drift between chains', () => {
		const mgr = new SessionContextManager()
		mgr.updateFromChain(makeChain('analyze code quality'), 'test-session')
		mgr.updateFromChain(makeChain('deploy to production'), 'test-session')
		const drift = mgr.detectDrift('test-session')
		expect(drift).toBeGreaterThan(0)
	})

	it('reports zero drift for similar queries', () => {
		const mgr = new SessionContextManager()
		mgr.updateFromChain(makeChain('analyze code quality'), 'test-session')
		mgr.updateFromChain(makeChain('analyze code tests'), 'test-session')
		const drift = mgr.detectDrift('test-session')
		expect(drift).toBeLessThan(0.5)
	})

	it('clears sessions', () => {
		const mgr = new SessionContextManager()
		mgr.getSession('test-session')
		mgr.clearSession('test-session')
		expect(mgr.getActiveSessions()).toEqual([])
	})

	it('clears all sessions', () => {
		const mgr = new SessionContextManager()
		mgr.getSession('a')
		mgr.getSession('b')
		mgr.clearAll()
		expect(mgr.getActiveSessions()).toEqual([])
	})
})
