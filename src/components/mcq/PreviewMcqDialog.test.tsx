// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PreviewMcqDialog } from "./PreviewMcqDialog";

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

describe("PreviewMcqDialog", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubGlobal("fetch", vi.fn());
	});

	it("fetches the MCQ when opened", async () => {
		vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ mcq }), { status: 200 }));
		render(<PreviewMcqDialog open onOpenChange={vi.fn()} mcqId="mcq-1" />);

		await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/mcqs/mcq-1"));
		expect(await screen.findByText(/which gas do plants absorb/i)).toBeTruthy();
		expect(screen.getByText("Carbon dioxide")).toBeTruthy();
		expect(screen.getByText("Oxygen")).toBeTruthy();
	});

	it("does not reveal the correct answer until a choice is selected", async () => {
		vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ mcq }), { status: 200 }));
		render(<PreviewMcqDialog open onOpenChange={vi.fn()} mcqId="mcq-1" />);

		await screen.findByText(/which gas do plants absorb/i);
		expect(screen.queryByText(/^correct$/i)).toBeNull();
		expect(screen.queryByText(/^incorrect$/i)).toBeNull();
	});

	it("shows Correct when the author picks the right choice without writing to the API", async () => {
		const user = userEvent.setup({ pointerEventsCheck: 0 });
		vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ mcq }), { status: 200 }));
		render(<PreviewMcqDialog open onOpenChange={vi.fn()} mcqId="mcq-1" />);

		await screen.findByText(/which gas do plants absorb/i);
		await user.click(screen.getByRole("radio", { name: /carbon dioxide/i }));

		expect(await screen.findByText(/^correct$/i)).toBeTruthy();
		expect(screen.queryByText(/^incorrect$/i)).toBeNull();
		expect(fetch).toHaveBeenCalledTimes(1);
		expect(fetch).toHaveBeenCalledWith("/api/mcqs/mcq-1");
	});

	it("shows Incorrect when the author picks a wrong choice and still does not reveal the answer key", async () => {
		const user = userEvent.setup({ pointerEventsCheck: 0 });
		vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ mcq }), { status: 200 }));
		render(<PreviewMcqDialog open onOpenChange={vi.fn()} mcqId="mcq-1" />);

		await screen.findByText(/which gas do plants absorb/i);
		await user.click(screen.getByRole("radio", { name: /oxygen/i }));

		expect(await screen.findByText(/^incorrect$/i)).toBeTruthy();
		expect(screen.queryByText(/^correct$/i)).toBeNull();
		expect(fetch).toHaveBeenCalledTimes(1);
	});

	it("does not fetch when closed", () => {
		render(<PreviewMcqDialog open={false} onOpenChange={vi.fn()} mcqId="mcq-1" />);
		expect(fetch).not.toHaveBeenCalled();
	});

	it("shows an error when the fetch fails", async () => {
		vi.mocked(fetch).mockResolvedValue(
			new Response(JSON.stringify({ error: { message: "Question not found" } }), { status: 404 }),
		);
		render(<PreviewMcqDialog open onOpenChange={vi.fn()} mcqId="missing" />);

		expect(await screen.findByText(/question not found|unable to load/i)).toBeTruthy();
	});

	it("Close dismisses the dialog", async () => {
		const user = userEvent.setup({ pointerEventsCheck: 0 });
		const onOpenChange = vi.fn();
		vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ mcq }), { status: 200 }));
		render(<PreviewMcqDialog open onOpenChange={onOpenChange} mcqId="mcq-1" />);

		await screen.findByText(/which gas do plants absorb/i);
		await user.click(screen.getByRole("button", { name: /^close$/i }));

		expect(onOpenChange).toHaveBeenCalledWith(false);
	});
});
