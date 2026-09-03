// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn(), refresh, replace: vi.fn() }),
}));

import { DeleteMcqDialog } from "./DeleteMcqDialog";

describe("DeleteMcqDialog", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubGlobal("fetch", vi.fn());
	});

	it("Cancel closes without a request", async () => {
		const user = userEvent.setup({ pointerEventsCheck: 0 });
		const onOpenChange = vi.fn();
		render(
			<DeleteMcqDialog
				open
				onOpenChange={onOpenChange}
				mcq={{ id: "mcq-1", name: "Photosynthesis basics" }}
			/>,
		);

		await user.click(screen.getByRole("button", { name: /cancel/i }));

		expect(fetch).not.toHaveBeenCalled();
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it("Confirm sends DELETE to the right URL", async () => {
		const user = userEvent.setup({ pointerEventsCheck: 0 });
		vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));
		render(
			<DeleteMcqDialog
				open
				onOpenChange={vi.fn()}
				mcq={{ id: "mcq-1", name: "Photosynthesis basics" }}
			/>,
		);

		await user.click(screen.getByRole("button", { name: /^delete$/i }));

		await waitFor(() => expect(fetch).toHaveBeenCalled());
		const [url, init] = vi.mocked(fetch).mock.calls[0];
		expect(url).toBe("/api/mcqs/mcq-1");
		expect(init?.method).toBe("DELETE");
	});

	it("success refreshes the list", async () => {
		const user = userEvent.setup({ pointerEventsCheck: 0 });
		const onOpenChange = vi.fn();
		vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));
		render(
			<DeleteMcqDialog
				open
				onOpenChange={onOpenChange}
				mcq={{ id: "mcq-1", name: "Photosynthesis basics" }}
			/>,
		);

		await user.click(screen.getByRole("button", { name: /^delete$/i }));

		await waitFor(() => {
			expect(refresh).toHaveBeenCalled();
			expect(onOpenChange).toHaveBeenCalledWith(false);
		});
	});

	it("states that the question and its choices will be deleted", () => {
		render(
			<DeleteMcqDialog
				open
				onOpenChange={vi.fn()}
				mcq={{ id: "mcq-1", name: "Photosynthesis basics" }}
			/>,
		);

		const dialog = screen.getByRole("dialog");
		expect(dialog.textContent).toMatch(/photosynthesis basics/i);
		expect(dialog.textContent).toMatch(/choices/i);
		expect(dialog.textContent).toMatch(/cannot be undone|permanently/i);
	});

	it("failure keeps the dialog open with an error", async () => {
		const user = userEvent.setup({ pointerEventsCheck: 0 });
		const onOpenChange = vi.fn();
		vi.mocked(fetch).mockResolvedValue(
			new Response(JSON.stringify({ error: { message: "Unable to delete question" } }), {
				status: 500,
			}),
		);
		render(
			<DeleteMcqDialog
				open
				onOpenChange={onOpenChange}
				mcq={{ id: "mcq-1", name: "Photosynthesis basics" }}
			/>,
		);

		await user.click(screen.getByRole("button", { name: /^delete$/i }));

		expect(await screen.findByText(/unable to delete question/i)).toBeTruthy();
		expect(refresh).not.toHaveBeenCalled();
		expect(onOpenChange).not.toHaveBeenCalledWith(false);
	});
});
