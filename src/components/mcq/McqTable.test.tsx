// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push, refresh, replace: vi.fn() }),
}));

import type { Mcq } from "@/lib/services/mcq-service";

import { McqTable } from "./McqTable";

const questions: Mcq[] = [
	{
		id: "mcq-1",
		name: "Photosynthesis basics",
		question: "Which gas?",
		description: "Light-dependent reaction",
		createdByUserId: null,
		createdAt: "2026-01-01 00:00:00",
		updatedAt: "2026-01-01 00:00:00",
	},
	{
		id: "mcq-2",
		name: "Cell division",
		question: "What is mitosis?",
		description: null,
		createdByUserId: null,
		createdAt: "2026-01-02 00:00:00",
		updatedAt: "2026-01-02 00:00:00",
	},
];

describe("McqTable", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubGlobal("fetch", vi.fn());
	});

	it("renders a row per question with name and description", () => {
		render(<McqTable mcqs={questions} />);

		expect(screen.getByText("Photosynthesis basics")).toBeTruthy();
		expect(screen.getByText("Light-dependent reaction")).toBeTruthy();
		expect(screen.getByText("Cell division")).toBeTruthy();
	});

	it("renders an em dash for a null description", () => {
		render(<McqTable mcqs={questions} />);

		const row = screen.getByText("Cell division").closest("tr");
		expect(row).toBeTruthy();
		expect(within(row as HTMLElement).getByText("—")).toBeTruthy();
	});

	it("renders an empty state when there are no questions", () => {
		render(<McqTable mcqs={[]} />);

		expect(screen.getByText(/no questions yet/i)).toBeTruthy();
		expect(screen.getByRole("link", { name: /create multiple choice question/i })).toBeTruthy();
		expect(screen.queryByRole("row", { name: /photosynthesis/i })).toBeNull();
	});

	it("opens the Action menu with Preview, Edit, and Delete", async () => {
		const user = userEvent.setup({ pointerEventsCheck: 0 });
		render(<McqTable mcqs={questions} />);

		await user.click(screen.getByRole("button", { name: /actions for photosynthesis basics/i }));

		expect(await screen.findByRole("menuitem", { name: /^preview$/i })).toBeTruthy();
		expect(await screen.findByRole("menuitem", { name: /^edit$/i })).toBeTruthy();
		expect(
			await screen.findByRole("menuitem", { name: /^delete$/i }),
		).toBeTruthy();
	});

	it("gives each row a distinguishable Action menu trigger", () => {
		render(<McqTable mcqs={questions} />);

		expect(screen.getByRole("button", { name: /actions for photosynthesis basics/i })).toBeTruthy();
		expect(screen.getByRole("button", { name: /actions for cell division/i })).toBeTruthy();
	});

	it("navigates to the edit page from Edit", async () => {
		const user = userEvent.setup({ pointerEventsCheck: 0 });
		render(<McqTable mcqs={questions} />);

		await user.click(screen.getByRole("button", { name: /actions for photosynthesis basics/i }));
		await user.click(await screen.findByRole("menuitem", { name: /^edit$/i }));

		expect(push).toHaveBeenCalledWith("/questions/mcq-1/edit");
	});

	it("opens Preview and fetches the full MCQ", async () => {
		const user = userEvent.setup({ pointerEventsCheck: 0 });
		vi.mocked(fetch).mockResolvedValue(
			new Response(
				JSON.stringify({
					mcq: {
						...questions[0],
						choices: [
							{ id: "c1", mcqId: "mcq-1", text: "Carbon dioxide", isCorrect: true, position: 1 },
							{ id: "c2", mcqId: "mcq-1", text: "Oxygen", isCorrect: false, position: 2 },
						],
					},
				}),
				{ status: 200 },
			),
		);
		render(<McqTable mcqs={questions} />);

		await user.click(screen.getByRole("button", { name: /actions for photosynthesis basics/i }));
		await user.click(await screen.findByRole("menuitem", { name: /^preview$/i }));

		expect(await screen.findByRole("dialog")).toBeTruthy();
		await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/mcqs/mcq-1"));
		expect(await screen.findByText(/which gas/i)).toBeTruthy();
		expect(screen.getByText(/^correct answer$/i)).toBeTruthy();
	});

	it("opens the confirmation dialog from Delete without calling fetch yet", async () => {
		const user = userEvent.setup({ pointerEventsCheck: 0 });
		render(<McqTable mcqs={questions} />);

		await user.click(screen.getByRole("button", { name: /actions for photosynthesis basics/i }));
		await user.click(await screen.findByRole("menuitem", { name: /^delete$/i }));

		expect(await screen.findByRole("dialog")).toBeTruthy();
		expect(screen.getByRole("button", { name: /^delete$/i })).toBeTruthy();
		expect(screen.getByRole("dialog").textContent).toMatch(/photosynthesis basics/i);
		expect(screen.getByRole("dialog").textContent).toMatch(/choices/i);
		expect(fetch).not.toHaveBeenCalled();
	});
});
