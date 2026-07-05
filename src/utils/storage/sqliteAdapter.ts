/**
 * SQLite backend adapter — presents a single bun:sqlite-compatible surface
 * over whichever backend is available at runtime.
 *
 * - Bun runtime  → native `bun:sqlite` (used directly, it already matches).
 * - Node runtime → built-in `node:sqlite` (`DatabaseSync`, Node 22+), wrapped
 *   to expose the `exec`/`prepare`/`query`/`transaction`/`close` shape that
 *   `SQLiteProvider` was written against.
 *
 * This lets the knowledge-graph SQLite persistence work under the Node runtime
 * (the production `dist` runs on Node), not just under Bun. Named parameters
 * use the `$name` token style, which both backends accept via a single
 * anonymous object argument.
 */

/** A prepared statement: `run`/`all`/`get` accept positional or one anonymous object. */
export interface SqliteStatement {
	run(...params: unknown[]): unknown
	all(...params: unknown[]): unknown[]
	get(...params: unknown[]): unknown
}

/** The unified connection surface `SQLiteProvider` consumes. */
export interface SqliteConnection {
	exec(sql: string): void
	prepare(sql: string): SqliteStatement
	/** `query` is a bun:sqlite convenience; on Node it maps to `prepare`. */
	query(sql: string): SqliteStatement
	/** Returns a thunk that runs `fn` inside a transaction. */
	transaction<T>(fn: () => T): () => T
	close(): void
}

/**
 * Open a normalized SQLite connection at `dbPath`. Throws if neither backend
 * is available; callers (SQLiteProvider) catch and self-heal/fall back to JSON.
 */
export async function openSqliteConnection(dbPath: string): Promise<SqliteConnection> {
	// Bun: native bun:sqlite already implements the surface we use.
	if (typeof Bun !== 'undefined') {
		const { Database } = await import('bun:sqlite')
		return new Database(dbPath) as unknown as SqliteConnection
	}

	// Node: built-in node:sqlite (DatabaseSync). Wrap to match the surface.
	const { DatabaseSync } = await import('node:sqlite')
	const db = new DatabaseSync(dbPath)

	const wrap = (stmt: {
		run(...params: unknown[]): unknown
		all(...params: unknown[]): unknown[]
		get(...params: unknown[]): unknown
	}): SqliteStatement => ({
		run: (...params: unknown[]) => stmt.run(...params),
		all: (...params: unknown[]) => stmt.all(...params),
		get: (...params: unknown[]) => stmt.get(...params),
	})

	return {
		exec: (sql: string) => db.exec(sql),
		prepare: (sql: string) => wrap(db.prepare(sql)),
		query: (sql: string) => wrap(db.prepare(sql)),
		transaction:
			<T>(fn: () => T) =>
			() => {
				db.exec('BEGIN')
				try {
					const result = fn()
					db.exec('COMMIT')
					return result
				} catch (error) {
					try {
						db.exec('ROLLBACK')
					} catch {
						// ignore rollback failure — the original error is what matters
					}
					throw error
				}
			},
		close: () => db.close(),
	}
}
