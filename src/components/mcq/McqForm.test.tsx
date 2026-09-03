// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push, refresh: vi.fn(), replace: vi.fn() }),
}));

import type { McqWithChoices } from "@/lib/services/mcq-service";

import { McqForm } from "./McqForm";

const existing: McqWithChoices = {
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

async function fillValidCreate(user: ReturnType<typeof userEvent.setup>) {
	await user.type(screen.getByLabelText(/^name$/i), "New question");
	await user.type(screen.getByLabelText(/^question$/i), "What is 2 + 2?");
	await user.type(screen.getByLabelText(/choice 1 text/i), "4");
	await user.type(screen.getByLabelText(/choice 2 text/i), "5");
	await user.click(screen.getByLabelText(/mark choice 1 correct/i));
}

describe("McqForm", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubGlobal("fetch", vi.fn());
	});

	it("starts with two empty choice rows on create", () => {
		render(<McqForm />);

		expect(screen.getAllByLabelText(/choice \d+ text/i)).toHaveLength(2);
	});

	it("pre-fills from an existing MCQ", () => {
		render(<McqForm mcq={existing} />);

		expect((screen.getByLabelText(/^name$/i) as HTMLInputElement).value).toBe("Photosynthesis basics");
		expect((screen.getByLabelText(/^question$/i) as HTMLTextAreaElement).value).toMatch(/which gas/i);
		expect((screen.getByLabelText(/^description$/i) as HTMLTextAreaElement).value).toMatch(/light-dependent/i);
		expect((screen.getByLabelText(/choice 1 text/i) as HTMLInputElement).value).toBe("Carbon dioxide");
		expect((screen.getByLabelText(/choice 2 text/i) as HTMLInputElement).value).toBe("Oxygen");
	});

	it("selects the saved correct choice", () => {
		render(<McqForm mcq={existing} />);

		expect(screen.getByLabelText(/mark choice 1 correct/i).getAttribute("aria-checked")).toBe("true");
		expect(screen.getByLabelText(/mark choice 2 correct/i).getAttribute("aria-checked")).toBe("false");
	});

	it("Add choice appends a row", async () => {
		const user = userEvent.setup();
		render(<McqForm />);

		await user.click(screen.getByRole("button", { name: /add choice/i }));

		expect(screen.getAllByLabelText(/choice \d+ text/i)).toHaveLength(3);
	});

	it("Add choice is disabled at six", async () => {
		const user = userEvent.setup();
		render(<McqForm />);

		for (let index = 0; index < 4; index += 1) {
			await user.click(screen.getByRole("button", { name: /add choice/i }));
		}

		expect(screen.getAllByLabelText(/choice \d+ text/i)).toHaveLength(6);
		expect((screen.getByRole("button", { name: /add choice/i }) as HTMLButtonElement).disabled).toBe(
			true,
		);
	});

	it("Remove is disabled when only two rows remain", () => {
		render(<McqForm />);

		const removeButtons = screen.getAllByRole("button", { name: /remove choice/i });
		expect(removeButtons).toHaveLength(2);
		expect(removeButtons.every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
	});

	it("Remove deletes the right row", async () => {
		const user = userEvent.setup();
		render(<McqForm mcq={existing} />);

		await user.click(screen.getByRole("button", { name: /add choice/i }));
		await user.type(screen.getByLabelText(/choice 3 text/i), "Nitrogen");
		await user.click(screen.getByRole("button", { name: /remove choice 1/i }));

		expect(screen.getAllByLabelText(/choice \d+ text/i)).toHaveLength(2);
		expect((screen.getByLabelText(/choice 1 text/i) as HTMLInputElement).value).toBe("Oxygen");
		expect((screen.getByLabelText(/choice 2 text/i) as HTMLInputElement).value).toBe("Nitrogen");
	});

	it("submitting with no correct choice does not POST", async () => {
		const user = userEvent.setup();
		render(<McqForm />);

		await user.type(screen.getByLabelText(/^name$/i), "New question");
		await user.type(screen.getByLabelText(/^question$/i), "What is 2 + 2?");
		await user.type(screen.getByLabelText(/choice 1 text/i), "4");
		await user.type(screen.getByLabelText(/choice 2 text/i), "5");
		await user.click(screen.getByRole("button", { name: /^save$/i }));

		expect(fetch).not.toHaveBeenCalled();
		expect(await screen.findByText(/exactly one choice must be marked correct/i)).toBeTruthy();
	});

	it("submitting with a blank name does not POST", async () => {
		const user = userEvent.setup();
		render(<McqForm />);

		await user.type(screen.getByLabelText(/^question$/i), "What is 2 + 2?");
		await user.type(screen.getByLabelText(/choice 1 text/i), "4");
		await user.type(screen.getByLabelText(/choice 2 text/i), "5");
		await user.click(screen.getByLabelText(/mark choice 1 correct/i));
		await user.click(screen.getByRole("button", { name: /^save$/i }));

		expect(fetch).not.toHaveBeenCalled();
		expect(await screen.findByText(/name is required/i)).toBeTruthy();
	});

	it("a valid create POSTs to /api/mcqs", async () => {
		const user = userEvent.setup();
		vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ mcq: existing }), { status: 201 }));
		render(<McqForm />);

		await fillValidCreate(user);
		await user.click(screen.getByRole("button", { name: /^save$/i }));

		await waitFor(() => expect(fetch).toHaveBeenCalled());
		const [url, init] = vi.mocked(fetch).mock.calls[0];
		expect(url).toBe("/api/mcqs");
		expect(init?.method).toBe("POST");
		const body = JSON.parse(String(init?.body));
		expect(body.name).toBe("New question");
		expect(body.question).toBe("What is 2 + 2?");
		expect(body.choices).toEqual([
			{ text: "4", isCorrect: true },
			{ text: "5", isCorrect: false },
		]);
	});

	it("a valid edit PUTs to /api/mcqs/{id}", async () => {
		const user = userEvent.setup();
		vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ mcq: existing }), { status: 200 }));
		render(<McqForm mcq={existing} />);

		await user.clear(screen.getByLabelText(/^name$/i));
		await user.type(screen.getByLabelText(/^name$/i), "Updated name");
		await user.click(screen.getByRole("button", { name: /^save$/i }));

		await waitFor(() => expect(fetch).toHaveBeenCalled());
		const [url, init] = vi.mocked(fetch).mock.calls[0];
		expect(url).toBe("/api/mcqs/mcq-1");
		expect(init?.method).toBe("PUT");
	});

	it("success navigates to /questions", async () => {
		const user = userEvent.setup();
		vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ mcq: existing }), { status: 201 }));
		render(<McqForm />);

		await fillValidCreate(user);
		await user.click(screen.getByRole("button", { name: /^save$/i }));

		await waitFor(() => expect(push).toHaveBeenCalledWith("/questions"));
	});

	it("a 400 renders the server's field messages", async () => {
		const user = userEvent.setup();
		vi.mocked(fetch).mockResolvedValue(
			new Response(JSON.stringify({ error: { message: "Validation failed", fields: { name: "Too short" } } }), {
				status: 400,
			}),
		);
		render(<McqForm />);

		await fillValidCreate(user);
		await user.click(screen.getByRole("button", { name: /^save$/i }));

		expect(await screen.findByText("Too short")).toBeTruthy();
	});

	it("Cancel navigates away without a request", async () => {
		const user = userEvent.setup();
		render(<McqForm />);

		await user.click(screen.getByRole("button", { name: /cancel/i }));

		expect(fetch).not.toHaveBeenCalled();
		expect(push).toHaveBeenCalledWith("/questions");
	});

	it("submit is disabled with a pending label while in flight", async () => {
		const user = userEvent.setup();
		let resolveFetch!: (value: Response) => void;
		vi.mocked(fetch).mockImplementation(
			() =>
				new Promise((resolve) => {
					resolveFetch = resolve;
				}),
		);
		render(<McqForm />);

		await fillValidCreate(user);
		await user.click(screen.getByRole("button", { name: /^save$/i }));

		const pending = await screen.findByRole("button", { name: /saving/i });
		expect((pending as HTMLButtonElement).disabled).toBe(true);

		resolveFetch(new Response(JSON.stringify({ mcq: existing }), { status: 201 }));
		await waitFor(() => expect(push).toHaveBeenCalledWith("/questions"));
	});
});
