// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
	useRouter: () => ({ replace }),
}));

import { LogoutButton } from "./LogoutButton";

describe("LogoutButton", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubGlobal("fetch", vi.fn());
	});

	it("POSTs /api/auth/logout on click", async () => {
		const user = userEvent.setup();
		vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));
		render(<LogoutButton />);

		await user.click(screen.getByRole("button", { name: /log out/i }));

		await waitFor(() => expect(fetch).toHaveBeenCalled());
		expect(String(vi.mocked(fetch).mock.calls[0][0])).toMatch(/\/api\/auth\/logout$/);
	});

	it("navigates to /login with replace", async () => {
		const user = userEvent.setup();
		vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));
		render(<LogoutButton />);

		await user.click(screen.getByRole("button", { name: /log out/i }));

		await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
	});

	it("still replaces to /login when the request fails", async () => {
		const user = userEvent.setup();
		vi.mocked(fetch).mockRejectedValue(new Error("network"));
		render(<LogoutButton />);

		await user.click(screen.getByRole("button", { name: /log out/i }));

		await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
	});
});
