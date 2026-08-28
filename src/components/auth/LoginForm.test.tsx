// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const replace = vi.fn();

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push, replace }),
}));

import { LoginForm } from "./LoginForm";

describe("LoginForm", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubGlobal("fetch", vi.fn());
	});

	it("renders username-or-email and password", () => {
		render(<LoginForm />);

		expect(screen.getByLabelText(/username or email/i)).toBeTruthy();
		expect(screen.getByLabelText(/^password$/i)).toBeTruthy();
		expect(screen.getByRole("button", { name: /sign in/i })).toBeTruthy();
	});

	it("POSTs identifier plus a transport hash and never a plaintext password", async () => {
		const user = userEvent.setup();
		vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ user: { id: "1" } }), { status: 200 }));
		render(<LoginForm />);

		await user.type(screen.getByLabelText(/username or email/i), "ada@example.edu");
		await user.type(screen.getByLabelText(/^password$/i), "secret1A");
		await user.click(screen.getByRole("button", { name: /sign in/i }));

		await waitFor(() => expect(fetch).toHaveBeenCalled());
		const [, init] = vi.mocked(fetch).mock.calls[0];
		const body = JSON.parse(String(init?.body));
		expect(body.identifier).toBe("ada@example.edu");
		expect(body.passwordHash).toMatch(/^[0-9a-f]{64}$/);
		expect(body).not.toHaveProperty("password");
	});

	it("navigates to /questions on 200", async () => {
		const user = userEvent.setup();
		vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ user: { id: "1" } }), { status: 200 }));
		render(<LoginForm />);

		await user.type(screen.getByLabelText(/username or email/i), "ada.lovelace");
		await user.type(screen.getByLabelText(/^password$/i), "secret1A");
		await user.click(screen.getByRole("button", { name: /sign in/i }));

		await waitFor(() => {
			expect(push.mock.calls[0]?.[0] ?? replace.mock.calls[0]?.[0]).toBe("/questions");
		});
	});

	it("shows a form-level invalid credentials message on 401", async () => {
		const user = userEvent.setup();
		vi.mocked(fetch).mockResolvedValue(
			new Response(JSON.stringify({ error: { message: "Invalid username or password" } }), { status: 401 }),
		);
		render(<LoginForm />);

		await user.type(screen.getByLabelText(/username or email/i), "ada.lovelace");
		await user.type(screen.getByLabelText(/^password$/i), "secret1A");
		await user.click(screen.getByRole("button", { name: /sign in/i }));

		const alert = await screen.findByRole("alert");
		expect(alert.textContent).toMatch(/invalid username or password/i);
		expect(screen.queryByLabelText(/username or email/i)?.closest("[data-invalid]")).toBeNull();
	});

	it("disables submit and shows a pending label while in flight", async () => {
		const user = userEvent.setup();
		let resolveFetch!: (value: Response) => void;
		vi.mocked(fetch).mockImplementation(
			() =>
				new Promise((resolve) => {
					resolveFetch = resolve;
				}),
		);
		render(<LoginForm />);

		await user.type(screen.getByLabelText(/username or email/i), "ada.lovelace");
		await user.type(screen.getByLabelText(/^password$/i), "secret1A");
		await user.click(screen.getByRole("button", { name: /sign in/i }));

		const pending = await screen.findByRole("button", { name: /signing in/i });
		expect((pending as HTMLButtonElement).disabled).toBe(true);

		resolveFetch(new Response(JSON.stringify({ user: { id: "1" } }), { status: 200 }));
		await waitFor(() => expect(push.mock.calls.length + replace.mock.calls.length).toBeGreaterThan(0));
	});
});
