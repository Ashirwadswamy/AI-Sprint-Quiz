import { webcrypto } from "node:crypto";

// jsdom provides a `crypto` global without `subtle`, so anything reaching for Web
// Crypto under that environment fails on a missing method rather than a missing global.
if (!globalThis.crypto?.subtle) {
	Object.defineProperty(globalThis, "crypto", {
		value: webcrypto,
		configurable: true,
	});
}
