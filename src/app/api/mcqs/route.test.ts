import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/services/mcq-service", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/services/mcq-service")>();
	return {
		...actual,
		createMcq: vi.fn(),
		listMcqs: vi.fn(),
	};
});

import { createMcq, listMcqs } from "@/lib/services/mcq-service";

import { GET, POST } from "./route";

const listItem = {
	id: "mcq-1",
	name: "Photosynthesis basics",
	question: "Which gas do plants absorb during photosynthesis?",
	description: "Covers the light-dependent reaction.",
	createdByUserId: null,
	createdAt: "2026-01-01 00:00:00",
	updatedAt: "2026-01-01 00:00:00",
};

const createdMcq = {
	...listItem,
	choices: [
		{ id: "choice-1", mcqId: "mcq-1", text: "Carbon dioxide", isCorrect: true, position: 1 },
		{ id: "choice-2", mcqId: "mcq-1", text: "Oxygen", isCorrect: false, position: 2 },
	],
};

const validBody = {
	name: " Photosynthesis basics ",
	question: " Which gas do plants absorb during photosynthesis? ",
	description: " Covers the light-dependent reaction. ",
	choices: [
		{ text: " Carbon dioxide ", isCorrect: true },
		{ text: " Oxygen ", isCorrect: false },
	],
};

function get() {
	return GET(new Request("http://localhost/api/mcqs", { method: "GET" }));
}

function post(body: unknown) {
	return POST(
		new Request("http://localhost/api/mcqs", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: typeof body === "string" ? body : JSON.stringify(body),
		}),
	);
}

describe("GET /api/mcqs", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.clearAllMocks();
	});

	it("returns 200 with the list", async () => {
		vi.mocked(listMcqs).mockResolvedValue([listItem]);

		const response = await get();
		const json = await response.json();

		expect(response.status).toBe(200);
		expect(json).toEqual({ mcqs: [listItem] });
	});

	it("returns an empty array, not 404, when there are no questions", async () => {
		vi.mocked(listMcqs).mockResolvedValue([]);

		const response = await get();
		const json = await response.json();

		expect(response.status).toBe(200);
		expect(json).toEqual({ mcqs: [] });
	});

	it("returns 500 when the service throws without leaking the message", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		vi.mocked(listMcqs).mockRejectedValue(new Error("secret db url"));

		const response = await get();
		const json = await response.json();

		expect(response.status).toBe(500);
		expect(json.error.message).toBe("Unable to load questions");
		expect(JSON.stringify(json)).not.toContain("secret db url");
	});
});

describe("POST /api/mcqs", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.clearAllMocks();
	});

	it("returns 201 with the created MCQ and choices", async () => {
		vi.mocked(createMcq).mockResolvedValue(createdMcq);

		const response = await post(validBody);
		const json = await response.json();

		expect(response.status).toBe(201);
		expect(json).toEqual({ mcq: createdMcq });
	});

	it("passes the parsed body through to createMcq", async () => {
		vi.mocked(createMcq).mockResolvedValue(createdMcq);

		await post(validBody);

		expect(createMcq).toHaveBeenCalledWith({
			name: "Photosynthesis basics",
			question: "Which gas do plants absorb during photosynthesis?",
			description: "Covers the light-dependent reaction.",
			choices: [
				{ text: "Carbon dioxide", isCorrect: true },
				{ text: "Oxygen", isCorrect: false },
			],
		});
	});

	it("returns 400 when name is missing", async () => {
		const { name: _name, ...rest } = validBody;
		const response = await post(rest);
		const json = await response.json();

		expect(response.status).toBe(400);
		expect(json.error.fields).toHaveProperty("name");
	});

	it("returns 400 on one choice", async () => {
		const response = await post({
			...validBody,
			choices: [{ text: "Only one", isCorrect: true }],
		});
		expect(response.status).toBe(400);
	});

	it("returns 400 on seven choices", async () => {
		const choices = Array.from({ length: 7 }, (_, index) => ({
			text: `Choice ${index + 1}`,
			isCorrect: index === 0,
		}));
		const response = await post({ ...validBody, choices });
		expect(response.status).toBe(400);
	});

	it("returns 400 when no choice is correct", async () => {
		const response = await post({
			...validBody,
			choices: [
				{ text: "A", isCorrect: false },
				{ text: "B", isCorrect: false },
			],
		});
		expect(response.status).toBe(400);
	});

	it("returns 400 on malformed JSON", async () => {
		const response = await post("{ not-json");
		expect(response.status).toBe(400);
	});

	it("returns 500 on unexpected errors without leaking the message", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		vi.mocked(createMcq).mockRejectedValue(new Error("secret connection string"));

		const response = await post(validBody);
		const json = await response.json();

		expect(response.status).toBe(500);
		expect(json.error.message).toBe("Unable to create question");
		expect(JSON.stringify(json)).not.toContain("secret connection string");
	});
});
