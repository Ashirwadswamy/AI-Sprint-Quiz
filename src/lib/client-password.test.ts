import { describe, expect, it } from "vitest";

import { hashPasswordForTransport } from "@/lib/client-password";

async function rawSha256Hex(value: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
	return Array.from(new Uint8Array(digest))
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

describe("hashPasswordForTransport", () => {
	it("hashes a password to 64 lowercase hex characters", async () => {
		await expect(hashPasswordForTransport("secret1A")).resolves.toMatch(/^[0-9a-f]{64}$/);
	});

	it("is deterministic for the same input", async () => {
		const first = await hashPasswordForTransport("secret1A");
		const second = await hashPasswordForTransport("secret1A");
		expect(first).toBe(second);
	});

	it("produces different digests for different passwords", async () => {
		const a = await hashPasswordForTransport("secret1A");
		const b = await hashPasswordForTransport("secret1B");
		expect(a).not.toBe(b);
	});

	it("includes the version prefix in the digest", async () => {
		const transport = await hashPasswordForTransport("secret1A");
		const raw = await rawSha256Hex("secret1A");
		expect(transport).not.toBe(raw);
	});
});
