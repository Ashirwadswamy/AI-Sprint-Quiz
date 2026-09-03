import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
	getDb: vi.fn(),
}));

import { getDb } from "@/lib/db";
import {
	createMcq,
	deleteMcq,
	getMcqById,
	listMcqs,
	McqNotFoundError,
	updateMcq,
} from "@/lib/services/mcq-service";
import { createFakeD1, type FakeD1 } from "@/test-support/fake-d1";

const mcqRow = {
	id: "mcq-1",
	name: "Photosynthesis basics",
	question: "Which gas do plants absorb during photosynthesis?",
	description: "Covers the light-dependent reaction.",
	created_by_user_id: null,
	created_at: "2026-01-01 00:00:00",
	updated_at: "2026-01-01 00:00:00",
};

const choiceRows = [
	{
		id: "choice-1",
		mcq_id: "mcq-1",
		choice_text: "Carbon dioxide",
		is_correct: 1,
		position: 1,
		created_at: "2026-01-01 00:00:00",
		updated_at: "2026-01-01 00:00:00",
	},
	{
		id: "choice-2",
		mcq_id: "mcq-1",
		choice_text: "Oxygen",
		is_correct: 0,
		position: 2,
		created_at: "2026-01-01 00:00:00",
		updated_at: "2026-01-01 00:00:00",
	},
];

const createInput = {
	name: " Photosynthesis basics ",
	question: " Which gas do plants absorb during photosynthesis? ",
	description: "   ",
	choices: [
		{ text: " Carbon dioxide ", isCorrect: true },
		{ text: " Oxygen ", isCorrect: false },
	],
};

let fake: FakeD1;

beforeEach(() => {
	vi.clearAllMocks();
	fake = createFakeD1();
	vi.mocked(getDb).mockResolvedValue(fake.db);
});

function queueBatchWrites(statementCount: number) {
	for (let index = 0; index < statementCount; index += 1) {
		fake.queueChanges(1);
	}
}

function queueMcqReadback(row = mcqRow, choices = choiceRows) {
	fake.queueRows([row]);
	fake.queueRows(choices);
}

function queueCreate(row = mcqRow, choices = choiceRows) {
	queueBatchWrites(1 + choices.length);
	queueMcqReadback(row, choices);
}

describe("createMcq", () => {
	it("writes the MCQ and its choices in one batch", async () => {
		const batchSpy = vi.spyOn(fake.db, "batch");
		queueCreate();

		await createMcq(createInput);

		expect(batchSpy).toHaveBeenCalledTimes(1);
		const insertSql = fake.calls.map((call) => call.sql).join("\n");
		expect(insertSql).toMatch(/INSERT INTO mcqs/i);
		expect(insertSql.match(/INSERT INTO mcq_choices/gi)?.length).toBe(2);
	});

	it("assigns positions from array order", async () => {
		queueCreate();

		await createMcq(createInput);

		const choiceInserts = fake.calls.filter((call) => /INSERT INTO mcq_choices/i.test(call.sql));
		expect(choiceInserts.map((call) => call.params[4])).toEqual([1, 2]);
		expect(choiceInserts.map((call) => call.params[2])).toEqual(["Carbon dioxide", "Oxygen"]);
	});

	it("trims text and stores null for empty description", async () => {
		queueCreate({ ...mcqRow, description: null });

		await createMcq(createInput);

		const insert = fake.calls.find((call) => /INSERT INTO mcqs/i.test(call.sql));
		expect(insert?.params[1]).toBe("Photosynthesis basics");
		expect(insert?.params[2]).toBe("Which gas do plants absorb during photosynthesis?");
		expect(insert?.params[3]).toBeNull();
	});

	it("returns the created MCQ with its choices", async () => {
		queueCreate();

		const created = await createMcq(createInput);

		expect(created).toEqual({
			id: "mcq-1",
			name: "Photosynthesis basics",
			question: "Which gas do plants absorb during photosynthesis?",
			description: "Covers the light-dependent reaction.",
			createdByUserId: null,
			createdAt: "2026-01-01 00:00:00",
			updatedAt: "2026-01-01 00:00:00",
			choices: [
				{
					id: "choice-1",
					mcqId: "mcq-1",
					text: "Carbon dioxide",
					isCorrect: true,
					position: 1,
				},
				{
					id: "choice-2",
					mcqId: "mcq-1",
					text: "Oxygen",
					isCorrect: false,
					position: 2,
				},
			],
		});
	});

	it("stores createdByUserId as null when absent", async () => {
		queueCreate();

		await createMcq(createInput);

		const insert = fake.calls.find((call) => /INSERT INTO mcqs/i.test(call.sql));
		expect(insert?.params[4]).toBeNull();
	});

	it("produces positions 1 through 6 for six choices", async () => {
		const sixChoices = Array.from({ length: 6 }, (_, index) => ({
			text: `Choice ${index + 1}`,
			isCorrect: index === 0,
		}));
		const sixRows = sixChoices.map((choice, index) => ({
			id: `choice-${index + 1}`,
			mcq_id: "mcq-1",
			choice_text: choice.text,
			is_correct: choice.isCorrect ? 1 : 0,
			position: index + 1,
			created_at: "2026-01-01 00:00:00",
			updated_at: "2026-01-01 00:00:00",
		}));
		queueCreate(mcqRow, sixRows);

		await createMcq({ ...createInput, choices: sixChoices });

		const choiceInserts = fake.calls.filter((call) => /INSERT INTO mcq_choices/i.test(call.sql));
		expect(choiceInserts.map((call) => call.params[4])).toEqual([1, 2, 3, 4, 5, 6]);
	});
});

describe("getMcqById", () => {
	it("returns the MCQ with choices in position order", async () => {
		fake.queueRows([mcqRow]);
		fake.queueRows(choiceRows);

		const mcq = await getMcqById("mcq-1");

		expect(fake.calls[1].sql).toMatch(/ORDER BY position/i);
		expect(mcq?.choices.map((choice) => choice.position)).toEqual([1, 2]);
	});

	it("returns null when missing and does not query choices", async () => {
		fake.queueRows([]);

		await expect(getMcqById("missing")).resolves.toBeNull();
		expect(fake.calls).toHaveLength(1);
		expect(fake.calls[0].sql).not.toMatch(/mcq_choices/i);
	});

	it("maps is_correct to a boolean", async () => {
		fake.queueRows([mcqRow]);
		fake.queueRows(choiceRows);

		const mcq = await getMcqById("mcq-1");

		expect(mcq?.choices[0].isCorrect).toBe(true);
		expect(mcq?.choices[0].isCorrect).not.toBe(1);
		expect(mcq?.choices[1].isCorrect).toBe(false);
	});
});

describe("listMcqs", () => {
	it("orders newest first and does not query choices", async () => {
		fake.queueRows([mcqRow]);

		const mcqs = await listMcqs();

		expect(fake.lastCall().sql).toMatch(/ORDER BY created_at DESC/i);
		expect(fake.calls).toHaveLength(1);
		expect(mcqs[0]).toMatchObject({
			id: "mcq-1",
			name: "Photosynthesis basics",
			createdByUserId: null,
		});
		expect(mcqs[0]).not.toHaveProperty("choices");
	});
});

describe("updateMcq", () => {
	it("sets updated_at", async () => {
		fake.queueChanges(1);
		queueMcqReadback({ ...mcqRow, name: "Updated", updated_at: "2026-01-02 00:00:00" });

		await updateMcq("mcq-1", { name: "Updated" });

		const updateCall = fake.calls.find((call) => /UPDATE mcqs/i.test(call.sql));
		expect(updateCall?.sql).toMatch(/updated_at/i);
	});

	it("replaces choices when they are supplied", async () => {
		fake.queueChanges(1);
		queueBatchWrites(3);
		queueMcqReadback();

		await updateMcq("mcq-1", {
			choices: [
				{ text: "New A", isCorrect: true },
				{ text: "New B", isCorrect: false },
			],
		});

		const sql = fake.calls.map((call) => call.sql).join("\n");
		expect(sql).toMatch(/DELETE FROM mcq_choices/i);
		expect(sql.match(/INSERT INTO mcq_choices/gi)?.length).toBe(2);
		const deleteIndex = fake.calls.findIndex((call) => /DELETE FROM mcq_choices/i.test(call.sql));
		const firstInsertIndex = fake.calls.findIndex((call) => /INSERT INTO mcq_choices/i.test(call.sql));
		expect(deleteIndex).toBeGreaterThan(-1);
		expect(firstInsertIndex).toBeGreaterThan(deleteIndex);
	});

	it("leaves choices alone when omitted", async () => {
		fake.queueChanges(1);
		queueMcqReadback();

		await updateMcq("mcq-1", { name: "Renamed only" });

		expect(fake.calls.some((call) => /DELETE FROM mcq_choices/i.test(call.sql))).toBe(false);
		expect(fake.calls.some((call) => /INSERT INTO mcq_choices/i.test(call.sql))).toBe(false);
	});

	it("throws McqNotFoundError when no row changes", async () => {
		fake.queueChanges(0);

		await expect(updateMcq("missing", { name: "Nope" })).rejects.toBeInstanceOf(McqNotFoundError);
	});
});

describe("deleteMcq", () => {
	it("removes choices and the MCQ", async () => {
		fake.queueChanges(2);
		fake.queueChanges(1);

		await expect(deleteMcq("mcq-1")).resolves.toBe(true);

		expect(fake.calls[0].sql).toMatch(/DELETE FROM mcq_choices/i);
		expect(fake.calls[1].sql).toMatch(/DELETE FROM mcqs/i);
	});

	it("returns false when nothing matched", async () => {
		fake.queueChanges(0);
		fake.queueChanges(0);

		await expect(deleteMcq("missing")).resolves.toBe(false);
	});
});

describe("SQL style", () => {
	it("uses numbered placeholders on every query", async () => {
		queueCreate();
		await createMcq(createInput);

		fake.queueRows([mcqRow]);
		fake.queueRows(choiceRows);
		await getMcqById("mcq-1");

		fake.queueRows([mcqRow]);
		await listMcqs();

		fake.queueChanges(1);
		queueBatchWrites(3);
		queueMcqReadback();
		await updateMcq("mcq-1", {
			name: "Updated",
			choices: [
				{ text: "A", isCorrect: true },
				{ text: "B", isCorrect: false },
			],
		});

		fake.queueChanges(1);
		fake.queueChanges(1);
		await deleteMcq("mcq-1");

		for (const call of fake.calls) {
			expect(call.sql, call.sql).not.toMatch(/\?(?!\d)/);
		}
	});
});
