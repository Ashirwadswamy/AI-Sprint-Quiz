/**
 * A stand-in for a D1 binding, for use in unit tests.
 *
 * Tests mock `@/lib/db` with one of these rather than rebuilding D1's
 * `prepare().bind().all()` chain each time. It records the SQL and the bound
 * parameters of every executed statement.
 */

export type RecordedCall = {
	sql: string;
	params: unknown[];
};

type QueuedResponse =
	| { kind: "rows"; rows: Record<string, unknown>[] }
	| { kind: "changes"; changes: number }
	| { kind: "error"; error: Error };

export type FakeD1 = {
	db: D1Database;
	calls: RecordedCall[];
	queueRows: (rows: Record<string, unknown>[]) => void;
	queueChanges: (changes: number) => void;
	queueError: (error: Error) => void;
	lastCall: () => RecordedCall;
};

function meta(changes: number): D1Meta & Record<string, unknown> {
	return {
		duration: 0,
		size_after: 0,
		rows_read: 0,
		rows_written: 0,
		last_row_id: 0,
		changed_db: changes > 0,
		changes,
	};
}

export function createFakeD1(): FakeD1 {
	const calls: RecordedCall[] = [];
	const queue: QueuedResponse[] = [];

	function execute(sql: string, params: unknown[]) {
		calls.push({ sql, params });

		const next = queue.shift();
		if (next?.kind === "error") {
			return Promise.reject(next.error);
		}
		if (next?.kind === "changes") {
			return Promise.resolve({ success: true as const, meta: meta(next.changes), results: [] });
		}

		const rows = next?.kind === "rows" ? next.rows : [];
		return Promise.resolve({ success: true as const, meta: meta(rows.length), results: rows });
	}

	function statement(sql: string, params: unknown[]) {
		return {
			bind: (...next: unknown[]) => statement(sql, next),
			all: () => execute(sql, params),
			run: () => execute(sql, params),
			first: async () => {
				const { results } = await execute(sql, params);
				return results[0] ?? null;
			},
			raw: async () => {
				const { results } = await execute(sql, params);
				return results;
			},
		};
	}

	const db = {
		prepare: (sql: string) => statement(sql, []),
		batch: async (statements: ReturnType<typeof statement>[]) => {
			const results = [];
			for (const stmt of statements) {
				results.push(await stmt.all());
			}
			return results;
		},
		exec: () => Promise.reject(new Error("fake-d1: exec() is not implemented")),
		withSession: () => {
			throw new Error("fake-d1: withSession() is not implemented");
		},
		dump: () => Promise.reject(new Error("fake-d1: dump() is not implemented")),
	};

	return {
		db: db as unknown as D1Database,
		calls,
		queueRows: (rows) => queue.push({ kind: "rows", rows }),
		queueChanges: (changes) => queue.push({ kind: "changes", changes }),
		queueError: (error) => queue.push({ kind: "error", error }),
		lastCall: () => calls[calls.length - 1],
	};
}
