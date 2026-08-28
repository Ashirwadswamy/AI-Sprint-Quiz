import { z } from "zod";

const passwordHash = z
	.string()
	.regex(/^[0-9a-f]{64}$/, "passwordHash must be 64 lowercase hex characters");

export const registerSchema = z.object({
	firstName: z.string().trim().min(1).max(100),
	lastName: z.string().trim().min(1).max(100),
	username: z
		.string()
		.trim()
		.min(3)
		.max(50)
		.regex(/^[A-Za-z0-9._@-]+$/),
	email: z.email().max(255),
	passwordHash,
});

export const loginSchema = z.object({
	identifier: z.string().trim().min(1),
	passwordHash,
});
