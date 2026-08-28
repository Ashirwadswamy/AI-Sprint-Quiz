import { verifyCredentials } from "@/lib/services/user-service";
import { loginSchema } from "@/lib/validation/auth-schemas";
import { toFieldErrors, toPublicUser } from "@/lib/validation/http";

export async function POST(request: Request) {
	const parsed = loginSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) {
		return Response.json({ error: toFieldErrors(parsed.error) }, { status: 400 });
	}

	try {
		const user = await verifyCredentials(parsed.data.identifier, parsed.data.passwordHash);
		if (!user) {
			return Response.json({ error: { message: "Invalid username or password" } }, { status: 401 });
		}
		return Response.json({ user: toPublicUser(user) }, { status: 200 });
	} catch (error) {
		console.error("login failed", error);
		return Response.json({ error: { message: "Unable to sign in" } }, { status: 500 });
	}
}
