import { createMcq, listMcqs } from "@/lib/services/mcq-service";
import { createMcqSchema } from "@/lib/validation/mcq-schemas";
import { toFieldErrors } from "@/lib/validation/http";

export async function GET() {
	try {
		const mcqs = await listMcqs();
		return Response.json({ mcqs }, { status: 200 });
	} catch (error) {
		console.error("list mcqs failed", error);
		return Response.json({ error: { message: "Unable to load questions" } }, { status: 500 });
	}
}

export async function POST(request: Request) {
	const parsed = createMcqSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) {
		return Response.json({ error: toFieldErrors(parsed.error) }, { status: 400 });
	}

	try {
		const mcq = await createMcq(parsed.data);
		return Response.json({ mcq }, { status: 201 });
	} catch (error) {
		console.error("create mcq failed", error);
		return Response.json({ error: { message: "Unable to create question" } }, { status: 500 });
	}
}
