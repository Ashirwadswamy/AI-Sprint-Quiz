import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = () => readFileSync(new URL("./0001_create_users_table.sql", import.meta.url), "utf8");

describe("users table migration", () => {
	it("exists", () => {
		expect(() => sql()).not.toThrow();
	});

	it("creates users", () => {
		expect(sql()).toMatch(/CREATE TABLE users/i);
	});

	it("declares every required column", () => {
		const text = sql();
		for (const column of [
			"id",
			"first_name",
			"last_name",
			"username",
			"email",
			"password_hash",
			"password_salt",
			"password_iterations",
			"created_at",
			"updated_at",
		]) {
			expect(text, `missing column ${column}`).toMatch(new RegExp(`\\b${column}\\b`));
		}
	});

	it("creates a unique index on username", () => {
		expect(sql()).toMatch(/UNIQUE INDEX \w*username/i);
	});

	it("creates a unique index on email", () => {
		expect(sql()).toMatch(/UNIQUE INDEX \w*email/i);
	});

	it("stores a hash column and no plaintext password column", () => {
		const text = sql();
		expect(text).toMatch(/password_hash/);
		expect(text).not.toMatch(/^\s*password\s+TEXT/im);
	});
});
