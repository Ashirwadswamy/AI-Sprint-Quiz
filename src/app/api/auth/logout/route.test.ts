import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/services/user-service", () => ({
	createUser: vi.fn(),
	verifyCredentials: vi.fn(),
	deleteUser: vi.fn(),
}));

import { createUser, deleteUser, verifyCredentials } from "@/lib/services/user-service";

import { POST } from "./route";

describe("POST /api/auth/logout", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns 200 with { success: true }", async () => {
		const response = await POST(
			new Request("http://localhost/api/auth/logout", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: "{}",
			}),
		);
		const json = await response.json();

		expect(response.status).toBe(200);
		expect(json).toEqual({ success: true });
	});

	it("does not call the user service", async () => {
		await POST(new Request("http://localhost/api/auth/logout", { method: "POST", body: "{}" }));

		expect(createUser).not.toHaveBeenCalled();
		expect(verifyCredentials).not.toHaveBeenCalled();
		expect(deleteUser).not.toHaveBeenCalled();
	});
});
