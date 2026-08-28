// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const replace = vi.fn();

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push, replace }),
}));

import { RegisterForm } from "./RegisterForm";

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
	await user.type(screen.getByLabelText(/first name/i), "Ada");
	await user.type(screen.getByLabelText(/last name/i), "Lovelace");
	await user.type(screen.getByLabelText(/^username$/i), "ada.lovelace");
	await user.type(screen.getByLabelText(/^email$/i), "ada@example.edu");
	await user.type(screen.getByLabelText(/^password$/i), "secret1A");
	await user.type(screen.getByLabelText(/confirm password/i), "secret1A");
}

describe("RegisterForm", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubGlobal("fetch", vi.fn());
	});

	it("renders the required fields", () => {
		render(<RegisterForm />);

		expect(screen.getByLabelText(/first name/i)).toBeTruthy();
		expect(screen.getByLabelText(/last name/i)).toBeTruthy();
		expect(screen.getByLabelText(/^username$/i)).toBeTruthy();
		expect(screen.getByLabelText(/^email$/i)).toBeTruthy();
		expect(screen.getByLabelText(/^password$/i)).toBeTruthy();
		expect(screen.getByLabelText(/confirm password/i)).toBeTruthy();
		expect(screen.getByRole("button", { name: /create account/i })).toBeTruthy();
	});

	it("does not POST when confirm password does not match", async () => {
		const user = userEvent.setup();
		render(<RegisterForm />);

		await user.type(screen.getByLabelText(/first name/i), "Ada");
		await user.type(screen.getByLabelText(/last name/i), "Lovelace");
		await user.type(screen.getByLabelText(/^username$/i), "ada.lovelace");
		await user.type(screen.getByLabelText(/^email$/i), "ada@example.edu");
		await user.type(screen.getByLabelText(/^password$/i), "secret1A");
		await user.type(screen.getByLabelText(/confirm password/i), "secret1B");
		await user.click(screen.getByRole("button", { name: /create account/i }));

		expect(fetch).not.toHaveBeenCalled();
	});

	it("POSTs a transport hash and never a plaintext password", async () => {
		const user = userEvent.setup();
		vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ user: { id: "1" } }), { status: 201 }));
		render(<RegisterForm />);

		await fillValidForm(user);
		await user.click(screen.getByRole("button", { name: /create account/i }));

		await waitFor(() => expect(fetch).toHaveBeenCalled());
		const [, init] = vi.mocked(fetch).mock.calls[0];
		const body = JSON.parse(String(init?.body));
		expect(body.passwordHash).toMatch(/^[0-9a-f]{64}$/);
		expect(body).not.toHaveProperty("password");
	});

	it("navigates to /questions on 201", async () => {
		const user = userEvent.setup();
		vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ user: { id: "1" } }), { status: 201 }));
		render(<RegisterForm />);

		await fillValidForm(user);
		await user.click(screen.getByRole("button", { name: /create account/i }));

		await waitFor(() => {
			expect(push.mock.calls[0]?.[0] ?? replace.mock.calls[0]?.[0]).toBe("/questions");
		});
	});

	it("shows a 409 error on the conflicting field", async () => {
		const user = userEvent.setup();
		vi.mocked(fetch).mockResolvedValue(
			new Response(
				JSON.stringify({
					error: { message: "Username or email already registered", fields: { email: "Already registered" } },
				}),
				{ status: 409 },
			),
		);
		render(<RegisterForm />);

		await fillValidForm(user);
		await user.click(screen.getByRole("button", { name: /create account/i }));

		expect(await screen.findByText(/already registered/i)).toBeTruthy();
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
		render(<RegisterForm />);

		await fillValidForm(user);
		await user.click(screen.getByRole("button", { name: /create account/i }));

		const pending = await screen.findByRole("button", { name: /creating account/i });
		expect((pending as HTMLButtonElement).disabled).toBe(true);

		resolveFetch(new Response(JSON.stringify({ user: { id: "1" } }), { status: 201 }));
		await waitFor(() => expect(push.mock.calls.length + replace.mock.calls.length).toBeGreaterThan(0));
	});
});
