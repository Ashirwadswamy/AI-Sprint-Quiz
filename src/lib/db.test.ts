import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@opennextjs/cloudflare", () => ({
	getCloudflareContext: vi.fn(),
}));

import { getCloudflareContext } from "@opennextjs/cloudflare";

import { getDb } from "@/lib/db";

const mockedGetCloudflareContext = vi.mocked(getCloudflareContext);

function contextWith(env: Record<string, unknown>) {
	return { env } as unknown as Awaited<ReturnType<typeof getCloudflareContext>>;
}

describe("getDb", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns the DB binding from the Cloudflare context", async () => {
		const binding = { name: "stand-in for a D1 binding" };
		mockedGetCloudflareContext.mockResolvedValue(contextWith({ DB: binding }));

		await expect(getDb()).resolves.toBe(binding);
	});

	it("requests the context asynchronously", async () => {
		mockedGetCloudflareContext.mockResolvedValue(contextWith({ DB: {} }));

		await getDb();

		expect(mockedGetCloudflareContext).toHaveBeenCalledWith({ async: true });
	});

	it("throws an explanatory error when the DB binding is missing", async () => {
		mockedGetCloudflareContext.mockResolvedValue(contextWith({}));

		await expect(getDb()).rejects.toThrow(/DB binding/i);
	});

	it("names a way forward in the error message", async () => {
		mockedGetCloudflareContext.mockResolvedValue(contextWith({}));

		await expect(getDb()).rejects.toThrow(/preview|ENABLE_CLOUDFLARE_DEV/);
	});
});
