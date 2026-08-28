import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// `.mts` rather than `.ts` so Vite's native config loader reads this as ESM.
export default defineConfig({
	// Resolves the `@/` alias from tsconfig.json.
	plugins: [tsconfigPaths()],
	test: {
		// The default `forks` pool has timed out on this machine. `threads` starts reliably.
		pool: "threads",

		// Node is the default: most of this codebase is server code that runs on Workers.
		// Component tests opt in per file with a `// @vitest-environment jsdom` docblock.
		environment: "node",

		globals: true,
		setupFiles: ["./vitest.setup.ts"],
	},
});
