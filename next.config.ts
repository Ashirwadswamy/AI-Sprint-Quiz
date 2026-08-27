import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	// Pin the workspace root so a stray lockfile elsewhere on the machine cannot
	// make Turbopack infer the wrong project directory.
	turbopack: {
		root: __dirname,
	},
};

export default nextConfig;

// Enable calling `getCloudflareContext()` in `next dev`.
// See https://opennext.js.org/cloudflare/bindings#local-access-to-bindings.
// workerd can crash on Windows (access violation). Skip unless explicitly enabled;
// use `npm run preview` to test against the Cloudflare runtime instead.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

if (process.env.ENABLE_CLOUDFLARE_DEV === "true") {
	initOpenNextCloudflareForDev();
} else if (process.platform === "win32") {
	console.warn(
		"[next.config] Cloudflare dev bindings disabled on Windows. Set ENABLE_CLOUDFLARE_DEV=true to enable, or use npm run preview.",
	);
}
