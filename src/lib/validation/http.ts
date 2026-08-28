import type { ZodError } from "zod";

import type { User } from "@/lib/services/user-service";

export function toFieldErrors(error: ZodError) {
	const fields: Record<string, string> = {};
	for (const issue of error.issues) {
		const key = issue.path[0];
		if (typeof key === "string" && fields[key] === undefined) {
			fields[key] = issue.message;
		}
	}
	return { message: "Validation failed", fields };
}

export function toPublicUser(user: User) {
	return {
		id: user.id,
		firstName: user.firstName,
		lastName: user.lastName,
		username: user.username,
		email: user.email,
	};
}
