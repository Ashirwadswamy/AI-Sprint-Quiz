import { describe, expect, it } from "vitest";

import { createFakeD1 } from "@/test-support/fake-d1";

describe("createFakeD1", () => {
	it("records the SQL and bound parameters of each executed statement", async () => {
		const fake = createFakeD1();

		await fake.db.prepare("SELECT * FROM users WHERE id = ?1 AND email = ?2").bind("abc", "ada@example.edu").all();

		expect(fake.lastCall()).toEqual({
			sql: "SELECT * FROM users WHERE id = ?1 AND email = ?2",
			params: ["abc", "ada@example.edu"],
		});
	});

	it("returns queued rows from all() and first()", async () => {
		const fake = createFakeD1();
		const row = { id: "1", username: "ada" };
		fake.queueRows([row]);

		const all = await fake.db.prepare("SELECT * FROM users").all();
		expect(all.results).toEqual([row]);

		fake.queueRows([row]);
		await expect(fake.db.prepare("SELECT * FROM users").first()).resolves.toEqual(row);
	});

	it("reports queued changes from run()", async () => {
		const fake = createFakeD1();
		fake.queueChanges(1);

		const result = await fake.db.prepare("DELETE FROM users WHERE id = ?1").bind("1").run();

		expect(result.meta.changes).toBe(1);
	});

	it("rejects the next statement with a queued error", async () => {
		const fake = createFakeD1();
		const error = new Error("UNIQUE constraint failed: users.email");
		fake.queueError(error);

		await expect(fake.db.prepare("INSERT INTO users (email) VALUES (?1)").bind("ada@example.edu").all()).rejects.toBe(
			error,
		);
	});

	it("batch() records every statement in order", async () => {
		const fake = createFakeD1();
		const first = fake.db.prepare("INSERT INTO mcqs (id) VALUES (?1)").bind("mcq-1");
		const second = fake.db.prepare("INSERT INTO mcq_choices (id) VALUES (?1)").bind("choice-1");

		await fake.db.batch([first, second]);

		expect(fake.calls).toEqual([
			{ sql: "INSERT INTO mcqs (id) VALUES (?1)", params: ["mcq-1"] },
			{ sql: "INSERT INTO mcq_choices (id) VALUES (?1)", params: ["choice-1"] },
		]);
	});

	it("batch() returns one result per statement", async () => {
		const fake = createFakeD1();
		fake.queueChanges(1);
		fake.queueChanges(1);

		const results = await fake.db.batch([
			fake.db.prepare("INSERT INTO mcqs (id) VALUES (?1)").bind("mcq-1"),
			fake.db.prepare("INSERT INTO mcq_choices (id) VALUES (?1)").bind("choice-1"),
		]);

		expect(results).toHaveLength(2);
		expect(results[0].meta.changes).toBe(1);
		expect(results[1].meta.changes).toBe(1);
	});

	it("batch() consumes the queue in order", async () => {
		const fake = createFakeD1();
		fake.queueRows([{ id: "mcq-1" }]);
		fake.queueRows([{ id: "choice-1" }]);

		const results = await fake.db.batch([
			fake.db.prepare("SELECT * FROM mcqs WHERE id = ?1").bind("mcq-1"),
			fake.db.prepare("SELECT * FROM mcq_choices WHERE id = ?1").bind("choice-1"),
		]);

		expect(results[0].results).toEqual([{ id: "mcq-1" }]);
		expect(results[1].results).toEqual([{ id: "choice-1" }]);
	});

	it("queueError rejects the whole batch and does not resolve later statements", async () => {
		const fake = createFakeD1();
		const error = new Error("FOREIGN KEY constraint failed");
		fake.queueError(error);
		fake.queueRows([{ id: "choice-1" }]);

		await expect(
			fake.db.batch([
				fake.db.prepare("INSERT INTO mcqs (id) VALUES (?1)").bind("mcq-1"),
				fake.db.prepare("INSERT INTO mcq_choices (id) VALUES (?1)").bind("choice-1"),
			]),
		).rejects.toBe(error);

		expect(fake.calls).toEqual([{ sql: "INSERT INTO mcqs (id) VALUES (?1)", params: ["mcq-1"] }]);
	});
});
