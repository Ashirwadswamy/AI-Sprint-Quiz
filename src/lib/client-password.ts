const TRANSPORT_PREFIX = "quizmaker:v1:";

export async function hashPasswordForTransport(password: string): Promise<string> {
	const encoded = new TextEncoder().encode(TRANSPORT_PREFIX + password);
	const digest = await crypto.subtle.digest("SHA-256", encoded);
	return toHex(digest);
}

function toHex(buffer: ArrayBuffer): string {
	return Array.from(new Uint8Array(buffer))
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}
