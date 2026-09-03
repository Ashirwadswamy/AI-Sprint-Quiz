import { getDb } from "@/lib/db";

const MCQ_COLUMNS =
	"id, name, question, description, created_by_user_id, created_at, updated_at";
const CHOICE_COLUMNS = "id, mcq_id, choice_text, is_correct, position, created_at, updated_at";

export type McqChoice = {
	id: string;
	mcqId: string;
	text: string;
	isCorrect: boolean;
	position: number;
};

export type Mcq = {
	id: string;
	name: string;
	question: string;
	description: string | null;
	createdByUserId: string | null;
	createdAt: string;
	updatedAt: string;
};

export type McqWithChoices = Mcq & { choices: McqChoice[] };

export type ChoiceInput = {
	text: string;
	isCorrect: boolean;
};

export type CreateMcqInput = {
	name: string;
	question: string;
	description?: string;
	createdByUserId?: string | null;
	choices: ChoiceInput[];
};

export type UpdateMcqInput = {
	name?: string;
	question?: string;
	description?: string;
	choices?: ChoiceInput[];
};

type McqRow = {
	id: string;
	name: string;
	question: string;
	description: string | null;
	created_by_user_id: string | null;
	created_at: string;
	updated_at: string;
};

type McqChoiceRow = {
	id: string;
	mcq_id: string;
	choice_text: string;
	is_correct: number;
	position: number;
	created_at: string;
	updated_at: string;
};

export class McqNotFoundError extends Error {
	constructor() {
		super("Question not found");
		this.name = "McqNotFoundError";
	}
}

function newId(): string {
	return Array.from(crypto.getRandomValues(new Uint8Array(16)))
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

function normalizeDescription(description: string | undefined): string | null {
	if (description === undefined) {
		return null;
	}
	const trimmed = description.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function toMcq(row: McqRow): Mcq {
	return {
		id: row.id,
		name: row.name,
		question: row.question,
		description: row.description,
		createdByUserId: row.created_by_user_id,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

function toChoice(row: McqChoiceRow): McqChoice {
	return {
		id: row.id,
		mcqId: row.mcq_id,
		text: row.choice_text,
		isCorrect: row.is_correct === 1,
		position: row.position,
	};
}

function choiceInsertStatements(
	db: D1Database,
	mcqId: string,
	choices: ChoiceInput[],
) {
	return choices.map((choice, index) =>
		db
			.prepare(
				`INSERT INTO mcq_choices (id, mcq_id, choice_text, is_correct, position)
         VALUES (?1, ?2, ?3, ?4, ?5)`,
			)
			.bind(newId(), mcqId, choice.text.trim(), choice.isCorrect ? 1 : 0, index + 1),
	);
}

export async function createMcq(input: CreateMcqInput): Promise<McqWithChoices> {
	const db = await getDb();
	const id = newId();

	const statements = [
		db
			.prepare(
				`INSERT INTO mcqs (id, name, question, description, created_by_user_id)
         VALUES (?1, ?2, ?3, ?4, ?5)`,
			)
			.bind(
				id,
				input.name.trim(),
				input.question.trim(),
				normalizeDescription(input.description),
				input.createdByUserId ?? null,
			),
		...choiceInsertStatements(db, id, input.choices),
	];

	await db.batch(statements);

	const created = await getMcqById(id);
	if (!created) {
		throw new Error("MCQ was inserted but could not be read back");
	}
	return created;
}

export async function getMcqById(id: string): Promise<McqWithChoices | null> {
	const db = await getDb();
	const { results } = await db
		.prepare(`SELECT ${MCQ_COLUMNS} FROM mcqs WHERE id = ?1`)
		.bind(id)
		.all<McqRow>();

	if (results.length === 0) {
		return null;
	}

	const { results: choiceResults } = await db
		.prepare(
			`SELECT ${CHOICE_COLUMNS}
       FROM mcq_choices
       WHERE mcq_id = ?1
       ORDER BY position ASC`,
		)
		.bind(id)
		.all<McqChoiceRow>();

	return {
		...toMcq(results[0]),
		choices: choiceResults.map(toChoice),
	};
}

export async function listMcqs(): Promise<Mcq[]> {
	const db = await getDb();
	const { results } = await db
		.prepare(`SELECT ${MCQ_COLUMNS} FROM mcqs ORDER BY created_at DESC`)
		.all<McqRow>();

	return results.map(toMcq);
}

export async function updateMcq(id: string, patch: UpdateMcqInput): Promise<McqWithChoices> {
	const db = await getDb();
	const assignments: string[] = [];
	const params: unknown[] = [];

	function add(column: string, value: unknown) {
		assignments.push(`${column} = ?${params.length + 1}`);
		params.push(value);
	}

	if (patch.name !== undefined) add("name", patch.name.trim());
	if (patch.question !== undefined) add("question", patch.question.trim());
	if (patch.description !== undefined) add("description", normalizeDescription(patch.description));

	assignments.push("updated_at = CURRENT_TIMESTAMP");
	params.push(id);

	const result = await db
		.prepare(`UPDATE mcqs SET ${assignments.join(", ")} WHERE id = ?${params.length}`)
		.bind(...params)
		.run();

	if (result.meta.changes === 0) {
		throw new McqNotFoundError();
	}

	if (patch.choices !== undefined) {
		await db.batch([
			db.prepare("DELETE FROM mcq_choices WHERE mcq_id = ?1").bind(id),
			...choiceInsertStatements(db, id, patch.choices),
		]);
	}

	const updated = await getMcqById(id);
	if (!updated) {
		throw new McqNotFoundError();
	}
	return updated;
}

export async function deleteMcq(id: string): Promise<boolean> {
	const db = await getDb();
	await db.prepare("DELETE FROM mcq_choices WHERE mcq_id = ?1").bind(id).run();
	const result = await db.prepare("DELETE FROM mcqs WHERE id = ?1").bind(id).run();
	return result.meta.changes > 0;
}
