import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = () => readFileSync(new URL("./0002_create_mcq_tables.sql", import.meta.url), "utf8");

function tableBody(text: string, tableName: string): string {
	const match = text.match(new RegExp(`CREATE TABLE ${tableName}\\s*\\(([^;]+)\\)`, "i"));
	expect(match, `missing CREATE TABLE ${tableName}`).toBeTruthy();
	return match?.[1] ?? "";
}

describe("mcq tables migration", () => {
	it("exists", () => {
		expect(() => sql()).not.toThrow();
	});

	it("creates mcqs, mcq_choices, and mcq_attempts", () => {
		const text = sql();
		expect(text).toMatch(/CREATE TABLE mcqs/i);
		expect(text).toMatch(/CREATE TABLE mcq_choices/i);
		expect(text).toMatch(/CREATE TABLE mcq_attempts/i);
	});

	it("declares every required mcqs column", () => {
		const text = sql();
		for (const column of ["id", "name", "question", "description", "created_by_user_id", "created_at", "updated_at"]) {
			expect(text, `missing column ${column}`).toMatch(new RegExp(`\\b${column}\\b`));
		}
	});

	it("keeps created_by_user_id nullable and referencing users", () => {
		const body = tableBody(sql(), "mcqs");
		expect(body).toMatch(/created_by_user_id\s+TEXT\s+REFERENCES\s+users\s*\(\s*id\s*\)/i);
		expect(body).not.toMatch(/created_by_user_id\s+TEXT\s+NOT NULL/i);
	});

	it("cascades mcq_choices deletes with the parent mcq", () => {
		const body = tableBody(sql(), "mcq_choices");
		expect(body).toMatch(/mcq_id\s+TEXT\s+NOT NULL\s+REFERENCES\s+mcqs\s*\(\s*id\s*\)\s+ON DELETE CASCADE/i);
	});

	it("bounds choice position between 1 and 6", () => {
		const body = tableBody(sql(), "mcq_choices");
		expect(body).toMatch(/CHECK\s*\(\s*position\s+BETWEEN\s+1\s+AND\s+6\s*\)/i);
	});

	it("makes choice position unique per mcq", () => {
		expect(sql()).toMatch(/UNIQUE INDEX \w*mcq_position/i);
		expect(sql()).toMatch(/mcq_choices\s*\(\s*mcq_id\s*,\s*position\s*\)/i);
	});

	it("records the selected choice on an attempt", () => {
		const body = tableBody(sql(), "mcq_attempts");
		expect(body).toMatch(/\bmcq_choice_id\b/);
		expect(body).toMatch(/\bselected_choice_text\b/);
		expect(body).toMatch(/\bis_correct\b/);
	});

	it("does not cascade-delete attempts when a choice is replaced", () => {
		const body = tableBody(sql(), "mcq_attempts");
		expect(body).toMatch(/mcq_choice_id\s+TEXT\s+REFERENCES\s+mcq_choices\s*\(\s*id\s*\)\s+ON DELETE SET NULL/i);
		expect(body).not.toMatch(/mcq_choice_id\s+TEXT\s+REFERENCES\s+mcq_choices\s*\(\s*id\s*\)\s+ON DELETE CASCADE/i);
	});
});
