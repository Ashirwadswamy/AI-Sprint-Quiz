const DEFAULT_ITERATIONS = 100_000;
const KEY_LENGTH_BITS = 256;
const SALT_BYTES = 16;

export async function hashPassword(transportHash: string) {
	const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
	const hash = await derive(transportHash, salt, DEFAULT_ITERATIONS);
	return { hash, salt: toHex(salt), iterations: DEFAULT_ITERATIONS };
}

export async function verifyPassword(
	transportHash: string,
	storedHash: string,
	storedSalt: string,
	iterations: number,
): Promise<boolean> {
	const candidate = await derive(transportHash, fromHex(storedSalt), iterations);
	return timingSafeEqual(candidate, storedHash);
}

async function derive(secret: string, salt: Uint8Array, iterations: number): Promise<string> {
	const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), "PBKDF2", false, [
		"deriveBits",
	]);
	const saltCopy = Uint8Array.from(salt);
	const bits = await crypto.subtle.deriveBits(
		{
			name: "PBKDF2",
			hash: "SHA-256",
			salt: saltCopy.buffer.slice(saltCopy.byteOffset, saltCopy.byteOffset + saltCopy.byteLength),
			iterations,
		},
		key,
		KEY_LENGTH_BITS,
	);
	return toHex(new Uint8Array(bits));
}

function toHex(bytes: Uint8Array): string {
	return Array.from(bytes)
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

function fromHex(hex: string): Uint8Array {
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < bytes.length; i += 1) {
		bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
	}
	return bytes;
}

function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let mismatch = 0;
	for (let i = 0; i < a.length; i += 1) {
		mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return mismatch === 0;
}
