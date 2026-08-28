import { describe, expect, it } from "vitest";

import { loginSchema, registerSchema } from "@/lib/validation/auth-schemas";

const validHash = "a".repeat(64);

const validRegister = {
	firstName: "Ada",
	lastName: "Lovelace",
	username: "ada.lovelace",
	email: "ada@example.edu",
	passwordHash: validHash,
};

describe("registerSchema", () => {
	it("accepts a valid body", () => {
		expect(registerSchema.safeParse(validRegister).success).toBe(true);
	});

	it("rejects a plaintext password instead of passwordHash", () => {
		const { passwordHash: _passwordHash, ...rest } = validRegister;
		expect(registerSchema.safeParse({ ...rest, password: "secret1A" }).success).toBe(false);
	});

	it("rejects a short or non-hex passwordHash", () => {
		expect(registerSchema.safeParse({ ...validRegister, passwordHash: "abc" }).success).toBe(false);
		expect(registerSchema.safeParse({ ...validRegister, passwordHash: "Z".repeat(64) }).success).toBe(
			false,
		);
	});
});

describe("loginSchema", () => {
	it("accepts a username or an email as identifier", () => {
		expect(loginSchema.safeParse({ identifier: "ada.lovelace", passwordHash: validHash }).success).toBe(
			true,
		);
		expect(
			loginSchema.safeParse({ identifier: "ada@example.edu", passwordHash: validHash }).success,
		).toBe(true);
	});

	it("rejects a missing passwordHash", () => {
		expect(loginSchema.safeParse({ identifier: "ada.lovelace" }).success).toBe(false);
	});
});
