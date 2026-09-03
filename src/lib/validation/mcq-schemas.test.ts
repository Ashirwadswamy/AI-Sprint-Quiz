import { describe, expect, it } from "vitest";

import { createMcqSchema, updateMcqSchema } from "@/lib/validation/mcq-schemas";

const twoChoices = [
	{ text: "Carbon dioxide", isCorrect: true },
	{ text: "Oxygen", isCorrect: false },
];

const validCreate = {
	name: "Photosynthesis basics",
	question: "Which gas do plants absorb during photosynthesis?",
	description: "Covers the inputs of the light-dependent reaction.",
	choices: twoChoices,
};

describe("createMcqSchema", () => {
	it("accepts a valid create body", () => {
		expect(createMcqSchema.safeParse(validCreate).success).toBe(true);
	});

	it("allows an omitted description", () => {
		const { description: _description, ...withoutDescription } = validCreate;
		expect(createMcqSchema.safeParse(withoutDescription).success).toBe(true);
	});

	it("rejects fewer than two choices", () => {
		expect(
			createMcqSchema.safeParse({
				...validCreate,
				choices: [{ text: "Only one", isCorrect: true }],
			}).success,
		).toBe(false);
	});

	it("rejects more than six choices", () => {
		const choices = Array.from({ length: 7 }, (_, index) => ({
			text: `Choice ${index + 1}`,
			isCorrect: index === 0,
		}));
		expect(createMcqSchema.safeParse({ ...validCreate, choices }).success).toBe(false);
	});

	it("rejects zero correct choices and names the problem", () => {
		const parsed = createMcqSchema.safeParse({
			...validCreate,
			choices: [
				{ text: "A", isCorrect: false },
				{ text: "B", isCorrect: false },
			],
		});
		expect(parsed.success).toBe(false);
		if (!parsed.success) {
			expect(parsed.error.issues.some((issue) => /exactly one/i.test(issue.message))).toBe(true);
		}
	});

	it("rejects more than one correct choice", () => {
		expect(
			createMcqSchema.safeParse({
				...validCreate,
				choices: [
					{ text: "A", isCorrect: true },
					{ text: "B", isCorrect: true },
				],
			}).success,
		).toBe(false);
	});

	it("rejects blank name, question, or choice text after trimming", () => {
		expect(createMcqSchema.safeParse({ ...validCreate, name: "   " }).success).toBe(false);
		expect(createMcqSchema.safeParse({ ...validCreate, question: "   " }).success).toBe(false);
		expect(
			createMcqSchema.safeParse({
				...validCreate,
				choices: [
					{ text: "   ", isCorrect: true },
					{ text: "Oxygen", isCorrect: false },
				],
			}).success,
		).toBe(false);
	});
});

describe("updateMcqSchema", () => {
	it("allows a partial body without choices", () => {
		expect(updateMcqSchema.safeParse({ name: "New" }).success).toBe(true);
	});

	it("still bounds a present choices array", () => {
		expect(
			updateMcqSchema.safeParse({
				choices: [{ text: "Only one", isCorrect: true }],
			}).success,
		).toBe(false);
	});
});
