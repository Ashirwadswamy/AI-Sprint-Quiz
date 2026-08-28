import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/services/user-service", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/services/user-service")>();
	return {
		...actual,
		createUser: vi.fn(),
		verifyCredentials: vi.fn(),
	};
});

import { createUser, UserConflictError } from "@/lib/services/user-service";

import { POST } from "./route";

const passwordHash = "a".repeat(64);

const validBody = {
	firstName: "Ada",
	lastName: "Lovelace",
	username: "ada.lovelace",
	email: "ada@example.edu",
	passwordHash,
};

const createdUser = {
	id: "user-1",
	firstName: "Ada",
	lastName: "Lovelace",
	username: "ada.lovelace",
	email: "ada@example.edu",
	createdAt: "2026-01-01",
	updatedAt: "2026-01-01",
};

function post(body: unknown) {
	return POST(
		new Request("http://localhost/api/auth/register", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: typeof body === "string" ? body : JSON.stringify(body),
		}),
	);
}

describe("POST /api/auth/register", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns 201 with a public user object", async () => {
		vi.mocked(createUser).mockResolvedValue(createdUser);

		const response = await post(validBody);
		const json = await response.json();

		expect(response.status).toBe(201);
		expect(json.user).toEqual({
			id: "user-1",
			firstName: "Ada",
			lastName: "Lovelace",
			username: "ada.lovelace",
			email: "ada@example.edu",
		});
		expect(json.user).not.toHaveProperty("createdAt");
		expect(json.user).not.toHaveProperty("password_hash");
		expect(json.user).not.toHaveProperty("password_salt");
		expect(json.user).not.toHaveProperty("password_iterations");
	});

	it("calls createUser with the parsed body and never a password field", async () => {
		vi.mocked(createUser).mockResolvedValue(createdUser);

		await post(validBody);

		expect(createUser).toHaveBeenCalledWith({
			firstName: "Ada",
			lastName: "Lovelace",
			username: "ada.lovelace",
			email: "ada@example.edu",
			passwordHash,
		});
		expect(vi.mocked(createUser).mock.calls[0][0]).not.toHaveProperty("password");
	});

	it("returns 400 with a named field when a field is missing", async () => {
		const { email: _email, ...rest } = validBody;
		const response = await post(rest);
		const json = await response.json();

		expect(response.status).toBe(400);
		expect(json.error.fields).toHaveProperty("email");
	});

	it("returns 400 when passwordHash is not 64 hex characters", async () => {
		const response = await post({ ...validBody, passwordHash: "abc" });
		expect(response.status).toBe(400);
	});

	it("returns 400 when the body has password instead of passwordHash", async () => {
		const { passwordHash: _passwordHash, ...rest } = validBody;
		const response = await post({ ...rest, password: "secret1A" });
		expect(response.status).toBe(400);
	});

	it("returns 409 on UserConflictError", async () => {
		vi.mocked(createUser).mockRejectedValue(new UserConflictError({ email: "Already registered" }));

		const response = await post(validBody);
		const json = await response.json();

		expect(response.status).toBe(409);
		expect(json.error.message).toBe("Username or email already registered");
	});

	it("returns 500 without leaking the thrown message", async () => {
		vi.mocked(createUser).mockRejectedValue(new Error("secret connection string"));

		const response = await post(validBody);
		const json = await response.json();

		expect(response.status).toBe(500);
		expect(json.error.message).toBe("Unable to create account");
		expect(JSON.stringify(json)).not.toContain("secret connection string");
	});

	it("never returns credential columns", async () => {
		vi.mocked(createUser).mockResolvedValue(createdUser);

		const json = await (await post(validBody)).json();
		const serialized = JSON.stringify(json);
		expect(serialized).not.toMatch(/password_hash|password_salt|password_iterations/);
	});
});
