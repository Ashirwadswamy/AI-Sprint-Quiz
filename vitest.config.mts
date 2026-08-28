import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// `.mts` rather than `.ts` so Vite's native config loader reads this as ESM.
export default defineConfig({
	plugins: [tsconfigPaths()],
	test: {
		globals: true,
		setupFiles: ["./vitest.setup.ts"],
		projects: [
			{
				extends: true,
				test: {
					name: "node",
					include: ["**/*.test.ts"],
					environment: "node",
					// Default forks pool has timed out on this machine for the server suite.
					pool: "threads",
				},
			},
			{
				extends: true,
				test: {
					name: "jsdom",
					include: ["**/*.test.tsx"],
					environment: "jsdom",
					setupFiles: ["./vitest.setup.ts", "./vitest.setup.jsdom.ts"],
					// jsdom + worker_threads hangs here (Node 26 alpha): workers never send
					// "started" and the pool times out. Forks give each component file a process.
					pool: "forks",
					maxWorkers: 1,
				},
			},
		],
	},
});
