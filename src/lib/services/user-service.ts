import { getDb } from "@/lib/db";
import * as password from "@/lib/password";

const PUBLIC_COLUMNS = "id, first_name, last_name, username, email, created_at, updated_at";
const DUMMY_HASH = "0".repeat(64);
const DUMMY_SALT = "11".repeat(16);
const DUMMY_ITERATIONS = 100_000;

export type User = {
	id: string;
	firstName: string;
	lastName: string;
	username: string;
	email: string;
	createdAt: string;
	updatedAt: string;
};

export type CreateUserInput = {
	firstName: string;
	lastName: string;
	username: string;
	email: string;
	passwordHash: string;
};

export type UpdateUserInput = {
	firstName?: string;
	lastName?: string;
	username?: string;
	email?: string;
	passwordHash?: string;
};

type UserRow = {
	id: string;
	first_name: string;
	last_name: string;
	username: string;
	email: string;
	created_at: string;
	updated_at: string;
	password_hash?: string;
	password_salt?: string;
	password_iterations?: number;
};

export class UserConflictError extends Error {
	fields: Record<string, string>;

	constructor(fields: Record<string, string>) {
		super("Username or email already registered");
		this.name = "UserConflictError";
		this.fields = fields;
	}
}

export class UserNotFoundError extends Error {
	constructor() {
		super("User not found");
		this.name = "UserNotFoundError";
	}
}

function normalizeIdentity(value: string): string {
	return value.trim().toLowerCase();
}

function toUser(row: UserRow): User {
	return {
		id: row.id,
		firstName: row.first_name,
		lastName: row.last_name,
		username: row.username,
		email: row.email,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

function isUniqueViolation(error: unknown): boolean {
	return error instanceof Error && /UNIQUE constraint failed/i.test(error.message);
}

function conflictFields(error: Error): Record<string, string> {
	if (/users\.email/i.test(error.message)) {
		return { email: "Already registered" };
	}
	if (/users\.username/i.test(error.message)) {
		return { username: "Already registered" };
	}
	return { username: "Already registered", email: "Already registered" };
}

function newUserId(): string {
	return Array.from(crypto.getRandomValues(new Uint8Array(16)))
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

export async function createUser(input: CreateUserInput): Promise<User> {
	const db = await getDb();
	const username = normalizeIdentity(input.username);
	const email = normalizeIdentity(input.email);
	const stored = await password.hashPassword(input.passwordHash);
	const id = newUserId();

	try {
		await db
			.prepare(
				`INSERT INTO users (id, first_name, last_name, username, email, password_hash, password_salt, password_iterations)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
			)
			.bind(
				id,
				input.firstName.trim(),
				input.lastName.trim(),
				username,
				email,
				stored.hash,
				stored.salt,
				stored.iterations,
			)
			.run();
	} catch (error) {
		if (error instanceof Error && isUniqueViolation(error)) {
			throw new UserConflictError(conflictFields(error));
		}
		throw error;
	}

	const created = await getUserById(id);
	if (!created) {
		throw new Error("User was inserted but could not be read back");
	}
	return created;
}

export async function getUserById(id: string): Promise<User | null> {
	const db = await getDb();
	const { results } = await db
		.prepare(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = ?1`)
		.bind(id)
		.all<UserRow>();

	return results.length > 0 ? toUser(results[0]) : null;
}

export async function findByUsernameOrEmail(identifier: string): Promise<User | null> {
	const db = await getDb();
	const normalized = normalizeIdentity(identifier);
	const { results } = await db
		.prepare(
			`SELECT ${PUBLIC_COLUMNS}
       FROM users
       WHERE username = ?1 OR email = ?1`,
		)
		.bind(normalized)
		.all<UserRow>();

	return results.length > 0 ? toUser(results[0]) : null;
}

export async function listUsers(): Promise<User[]> {
	const db = await getDb();
	const { results } = await db
		.prepare(`SELECT ${PUBLIC_COLUMNS} FROM users ORDER BY created_at DESC`)
		.all<UserRow>();

	return results.map(toUser);
}

export async function updateUser(id: string, patch: UpdateUserInput): Promise<User> {
	const db = await getDb();
	const assignments: string[] = [];
	const params: unknown[] = [];

	function add(column: string, value: unknown) {
		assignments.push(`${column} = ?${params.length + 1}`);
		params.push(value);
	}

	if (patch.firstName !== undefined) add("first_name", patch.firstName.trim());
	if (patch.lastName !== undefined) add("last_name", patch.lastName.trim());
	if (patch.username !== undefined) add("username", normalizeIdentity(patch.username));
	if (patch.email !== undefined) add("email", normalizeIdentity(patch.email));

	if (patch.passwordHash !== undefined) {
		const stored = await password.hashPassword(patch.passwordHash);
		add("password_hash", stored.hash);
		add("password_salt", stored.salt);
		add("password_iterations", stored.iterations);
	}

	assignments.push("updated_at = CURRENT_TIMESTAMP");
	params.push(id);

	try {
		const result = await db
			.prepare(`UPDATE users SET ${assignments.join(", ")} WHERE id = ?${params.length}`)
			.bind(...params)
			.run();

		if (result.meta.changes === 0) {
			throw new UserNotFoundError();
		}
	} catch (error) {
		if (error instanceof UserNotFoundError) throw error;
		if (error instanceof Error && isUniqueViolation(error)) {
			throw new UserConflictError(conflictFields(error));
		}
		throw error;
	}

	const updated = await getUserById(id);
	if (!updated) {
		throw new UserNotFoundError();
	}
	return updated;
}

export async function deleteUser(id: string): Promise<boolean> {
	const db = await getDb();
	const result = await db.prepare("DELETE FROM users WHERE id = ?1").bind(id).run();
	return result.meta.changes > 0;
}

export async function verifyCredentials(
	identifier: string,
	transportHash: string,
): Promise<User | null> {
	const db = await getDb();
	const normalized = normalizeIdentity(identifier);
	const { results } = await db
		.prepare(
			`SELECT ${PUBLIC_COLUMNS}, password_hash, password_salt, password_iterations
       FROM users
       WHERE username = ?1 OR email = ?1`,
		)
		.bind(normalized)
		.all<UserRow>();

	const row = results[0];
	if (!row || !row.password_hash || !row.password_salt || row.password_iterations === undefined) {
		await password.verifyPassword(transportHash, DUMMY_HASH, DUMMY_SALT, DUMMY_ITERATIONS);
		return null;
	}

	const matched = await password.verifyPassword(
		transportHash,
		row.password_hash,
		row.password_salt,
		row.password_iterations,
	);

	return matched ? toUser(row) : null;
}
