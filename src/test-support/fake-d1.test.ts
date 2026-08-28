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
});
