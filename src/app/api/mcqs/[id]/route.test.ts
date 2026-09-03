import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/services/mcq-service", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/services/mcq-service")>();
	return {
		...actual,
		deleteMcq: vi.fn(),
		getMcqById: vi.fn(),
		updateMcq: vi.fn(),
	};
});

import { deleteMcq, getMcqById, McqNotFoundError, updateMcq } from "@/lib/services/mcq-service";

import { DELETE, GET, PUT } from "./route";

const mcq = {
	id: "mcq-1",
	name: "Photosynthesis basics",
	question: "Which gas do plants absorb during photosynthesis?",
	description: "Covers the light-dependent reaction.",
	createdByUserId: null,
	createdAt: "2026-01-01 00:00:00",
	updatedAt: "2026-01-01 00:00:00",
	choices: [
		{ id: "choice-1", mcqId: "mcq-1", text: "Carbon dioxide", isCorrect: true, position: 1 },
		{ id: "choice-2", mcqId: "mcq-1", text: "Oxygen", isCorrect: false, position: 2 },
	],
};

type RouteContext = { params: Promise<{ id: string }> };

function context(id = "mcq-1"): RouteContext {
	return { params: Promise.resolve({ id }) };
}

function get(id = "mcq-1") {
	return GET(new Request(`http://localhost/api/mcqs/${id}`, { method: "GET" }), context(id));
}

function put(body: unknown, id = "mcq-1") {
	return PUT(
		new Request(`http://localhost/api/mcqs/${id}`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: typeof body === "string" ? body : JSON.stringify(body),
		}),
		context(id),
	);
}

function del(id = "mcq-1") {
	return DELETE(new Request(`http://localhost/api/mcqs/${id}`, { method: "DELETE" }), context(id));
}

describe("GET /api/mcqs/[id]", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.clearAllMocks();
	});

	it("returns 200 with the MCQ and choices", async () => {
		vi.mocked(getMcqById).mockResolvedValue(mcq);

		const response = await get();
		const json = await response.json();

		expect(response.status).toBe(200);
		expect(json).toEqual({ mcq });
	});

	it("awaits the params promise and passes the id through", async () => {
		vi.mocked(getMcqById).mockResolvedValue(mcq);

		await get("abc-123");

		expect(getMcqById).toHaveBeenCalledWith("abc-123");
	});

	it("returns 404 when the service returns null", async () => {
		vi.mocked(getMcqById).mockResolvedValue(null);

		const response = await get("missing");
		const json = await response.json();

		expect(response.status).toBe(404);
		expect(json.error.message).toBe("Question not found");
	});
});

describe("PUT /api/mcqs/[id]", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.clearAllMocks();
	});

	it("returns 200 on a valid partial body", async () => {
		vi.mocked(updateMcq).mockResolvedValue({ ...mcq, name: "Updated" });

		const response = await put({ name: "Updated" });
		const json = await response.json();

		expect(response.status).toBe(200);
		expect(updateMcq).toHaveBeenCalledWith("mcq-1", { name: "Updated" });
		expect(json.mcq.name).toBe("Updated");
	});

	it("returns 400 on an invalid choice set", async () => {
		const response = await put({
			choices: [{ text: "Only one", isCorrect: true }],
		});
		expect(response.status).toBe(400);
	});

	it("returns 404 on McqNotFoundError", async () => {
		vi.mocked(updateMcq).mockRejectedValue(new McqNotFoundError());

		const response = await put({ name: "Updated" });
		const json = await response.json();

		expect(response.status).toBe(404);
		expect(json.error.message).toBe("Question not found");
	});

	it("returns 500 on unexpected errors without leaking the message", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		vi.mocked(updateMcq).mockRejectedValue(new Error("secret connection string"));

		const response = await put({ name: "Updated" });
		const json = await response.json();

		expect(response.status).toBe(500);
		expect(json.error.message).toBe("Unable to update question");
		expect(JSON.stringify(json)).not.toContain("secret connection string");
	});
});

describe("DELETE /api/mcqs/[id]", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.clearAllMocks();
	});

	it("returns 200 with success true", async () => {
		vi.mocked(deleteMcq).mockResolvedValue(true);

		const response = await del();
		const json = await response.json();

		expect(response.status).toBe(200);
		expect(json).toEqual({ success: true });
	});

	it("returns 404 when nothing matched", async () => {
		vi.mocked(deleteMcq).mockResolvedValue(false);

		const response = await del("missing");
		const json = await response.json();

		expect(response.status).toBe(404);
		expect(json.error.message).toBe("Question not found");
	});

	it("returns 500 on unexpected errors without leaking the message", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		vi.mocked(deleteMcq).mockRejectedValue(new Error("secret connection string"));

		const response = await del();
		const json = await response.json();

		expect(response.status).toBe(500);
		expect(json.error.message).toBe("Unable to delete question");
		expect(JSON.stringify(json)).not.toContain("secret connection string");
	});
});
