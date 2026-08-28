import { createUser, UserConflictError } from "@/lib/services/user-service";
import { registerSchema } from "@/lib/validation/auth-schemas";
import { toFieldErrors, toPublicUser } from "@/lib/validation/http";

export async function POST(request: Request) {
	const parsed = registerSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) {
		return Response.json({ error: toFieldErrors(parsed.error) }, { status: 400 });
	}

	try {
		const user = await createUser(parsed.data);
		return Response.json({ user: toPublicUser(user) }, { status: 201 });
	} catch (error) {
		if (error instanceof UserConflictError) {
			return Response.json(
				{ error: { message: "Username or email already registered", fields: error.fields } },
				{ status: 409 },
			);
		}
		console.error("register failed", error);
		return Response.json({ error: { message: "Unable to create account" } }, { status: 500 });
	}
}
