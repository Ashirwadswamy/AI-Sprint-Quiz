import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "@/lib/password";

describe("hashPassword / verifyPassword", () => {
	it("stores a hash that is not the transport hash", async () => {
		const transport = "a".repeat(64);
		const stored = await hashPassword(transport);
		expect(stored.hash).not.toBe(transport);
	});

	it("uses a unique salt per call", async () => {
		const transport = "a".repeat(64);
		const first = await hashPassword(transport);
		const second = await hashPassword(transport);
		expect(first.salt).not.toBe(second.salt);
		expect(first.hash).not.toBe(second.hash);
	});

	it("verifies a matching transport hash", async () => {
		const transport = "a".repeat(64);
		const stored = await hashPassword(transport);
		await expect(
			verifyPassword(transport, stored.hash, stored.salt, stored.iterations),
		).resolves.toBe(true);
	});

	it("rejects a mismatched transport hash", async () => {
		const stored = await hashPassword("a".repeat(64));
		await expect(
			verifyPassword("b".repeat(64), stored.hash, stored.salt, stored.iterations),
		).resolves.toBe(false);
	});

	it("uses the stored iteration count", async () => {
		const transport = "a".repeat(64);
		const stored = await hashPassword(transport);
		await expect(verifyPassword(transport, stored.hash, stored.salt, 1)).resolves.toBe(false);
	});
});
