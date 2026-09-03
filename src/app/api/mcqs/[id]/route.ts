import {
	deleteMcq,
	getMcqById,
	McqNotFoundError,
	updateMcq,
} from "@/lib/services/mcq-service";
import { updateMcqSchema } from "@/lib/validation/mcq-schemas";
import { toFieldErrors } from "@/lib/validation/http";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
	const { id } = await params;

	try {
		const mcq = await getMcqById(id);
		if (!mcq) {
			return Response.json({ error: { message: "Question not found" } }, { status: 404 });
		}
		return Response.json({ mcq }, { status: 200 });
	} catch (error) {
		console.error("get mcq failed", error);
		return Response.json({ error: { message: "Unable to load question" } }, { status: 500 });
	}
}

export async function PUT(request: Request, { params }: RouteContext) {
	const { id } = await params;
	const parsed = updateMcqSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) {
		return Response.json({ error: toFieldErrors(parsed.error) }, { status: 400 });
	}

	try {
		const mcq = await updateMcq(id, parsed.data);
		return Response.json({ mcq }, { status: 200 });
	} catch (error) {
		if (error instanceof McqNotFoundError) {
			return Response.json({ error: { message: "Question not found" } }, { status: 404 });
		}
		console.error("update mcq failed", error);
		return Response.json({ error: { message: "Unable to update question" } }, { status: 500 });
	}
}

export async function DELETE(_request: Request, { params }: RouteContext) {
	const { id } = await params;

	try {
		const deleted = await deleteMcq(id);
		if (!deleted) {
			return Response.json({ error: { message: "Question not found" } }, { status: 404 });
		}
		return Response.json({ success: true }, { status: 200 });
	} catch (error) {
		console.error("delete mcq failed", error);
		return Response.json({ error: { message: "Unable to delete question" } }, { status: 500 });
	}
}
