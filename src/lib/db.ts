import { getCloudflareContext } from "@opennextjs/cloudflare";

// Server-only. Never import this module, or anything that imports it, from a
// `'use client'` component.

/**
 * The D1 binding for the users database.
 *
 * Every query in the app goes through here rather than reaching for the binding
 * directly, which also gives tests a single module to mock.
 */
export async function getDb(): Promise<D1Database> {
	const { env } = await getCloudflareContext({ async: true });
	const db = env.DB;

	if (!db) {
		throw new Error(
			"DB binding is not available. Cloudflare bindings are disabled under `next dev` on " +
				"Windows, so run `npm run preview` instead, or set ENABLE_CLOUDFLARE_DEV=true.",
		);
	}

	return db;
}
