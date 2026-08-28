import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/services/user-service", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/services/user-service")>();
	return {
		...actual,
		createUser: vi.fn(),
		verifyCredentials: vi.fn(),
	};
});

import { verifyCredentials } from "@/lib/services/user-service";

import { POST } from "./route";

const passwordHash = "a".repeat(64);

const publicUser = {
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
		new Request("http://localhost/api/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: typeof body === "string" ? body : JSON.stringify(body),
		}),
	);
}

describe("POST /api/auth/login", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns 200 with a public user when credentials match", async () => {
		vi.mocked(verifyCredentials).mockResolvedValue(publicUser);

		const response = await post({ identifier: "ada.lovelace", passwordHash });
		const json = await response.json();

		expect(response.status).toBe(200);
		expect(json.user).toEqual({
			id: "user-1",
			firstName: "Ada",
			lastName: "Lovelace",
			username: "ada.lovelace",
			email: "ada@example.edu",
		});
	});

	it("accepts an email as identifier", async () => {
		vi.mocked(verifyCredentials).mockResolvedValue(publicUser);

		await post({ identifier: "ada@example.edu", passwordHash });

		expect(verifyCredentials).toHaveBeenCalledWith("ada@example.edu", passwordHash);
	});

	it("accepts a username as identifier", async () => {
		vi.mocked(verifyCredentials).mockResolvedValue(publicUser);

		await post({ identifier: "ada.lovelace", passwordHash });

		expect(verifyCredentials).toHaveBeenCalledWith("ada.lovelace", passwordHash);
	});

	it("returns 401 Invalid username or password for a wrong password", async () => {
		vi.mocked(verifyCredentials).mockResolvedValue(null);

		const response = await post({ identifier: "ada.lovelace", passwordHash });
		const json = await response.json();

		expect(response.status).toBe(401);
		expect(json.error.message).toBe("Invalid username or password");
	});

	it("returns the same 401 for an unknown identifier", async () => {
		vi.mocked(verifyCredentials).mockResolvedValue(null);

		const response = await post({ identifier: "nobody", passwordHash });
		const json = await response.json();

		expect(response.status).toBe(401);
		expect(json.error.message).toBe("Invalid username or password");
	});

	it("returns 400 on a malformed body", async () => {
		const response = await post("not-json");
		expect(response.status).toBe(400);
	});

	it("returns 400 when the body has password instead of passwordHash", async () => {
		const response = await post({ identifier: "ada.lovelace", password: "secret1A" });
		expect(response.status).toBe(400);
	});

	it("returns 500 without leaking the thrown message", async () => {
		vi.mocked(verifyCredentials).mockRejectedValue(new Error("secret connection string"));

		const response = await post({ identifier: "ada.lovelace", passwordHash });
		const json = await response.json();

		expect(response.status).toBe(500);
		expect(json.error.message).toBe("Unable to sign in");
		expect(JSON.stringify(json)).not.toContain("secret connection string");
	});
});
