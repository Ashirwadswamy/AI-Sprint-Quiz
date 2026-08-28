import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
	getDb: vi.fn(),
}));

import { getDb } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import {
	createUser,
	deleteUser,
	findByUsernameOrEmail,
	getUserById,
	listUsers,
	updateUser,
	UserConflictError,
	UserNotFoundError,
	verifyCredentials,
} from "@/lib/services/user-service";
import { createFakeD1, type FakeD1 } from "@/test-support/fake-d1";

const transportHash = "a".repeat(64);
const otherTransportHash = "b".repeat(64);

const publicRow = {
	id: "user-1",
	first_name: "Ada",
	last_name: "Lovelace",
	username: "ada.lovelace",
	email: "ada@example.edu",
	created_at: "2026-01-01 00:00:00",
	updated_at: "2026-01-01 00:00:00",
};

function expectPublicUser(user: object) {
	expect(user).not.toHaveProperty("password_hash");
	expect(user).not.toHaveProperty("password_salt");
	expect(user).not.toHaveProperty("password_iterations");
	expect(user).toMatchObject({
		id: expect.any(String),
		firstName: expect.any(String),
		lastName: expect.any(String),
		username: expect.any(String),
		email: expect.any(String),
	});
}

let fake: FakeD1;

beforeEach(() => {
	vi.clearAllMocks();
	fake = createFakeD1();
	vi.mocked(getDb).mockResolvedValue(fake.db);
});

describe("createUser", () => {
	it("inserts a normalized username and email and returns public camelCase fields", async () => {
		fake.queueChanges(1);
		fake.queueRows([publicRow]);

		const user = await createUser({
			firstName: "Ada",
			lastName: "Lovelace",
			username: " Ada.Lovelace ",
			email: " Ada@Example.EDU ",
			passwordHash: transportHash,
		});

		const insert = fake.calls.find((call) => /INSERT/i.test(call.sql));
		expect(insert?.params).toEqual(expect.arrayContaining(["ada.lovelace", "ada@example.edu"]));
		expect(user).toEqual({
			id: "user-1",
			firstName: "Ada",
			lastName: "Lovelace",
			username: "ada.lovelace",
			email: "ada@example.edu",
			createdAt: "2026-01-01 00:00:00",
			updatedAt: "2026-01-01 00:00:00",
		});
		expectPublicUser(user);
	});

	it("stores a server hash, not the transport hash", async () => {
		fake.queueChanges(1);
		fake.queueRows([publicRow]);

		await createUser({
			firstName: "Ada",
			lastName: "Lovelace",
			username: "ada.lovelace",
			email: "ada@example.edu",
			passwordHash: transportHash,
		});

		const insert = fake.calls.find((call) => /INSERT/i.test(call.sql));
		expect(insert).toBeDefined();
		expect(insert?.params).not.toContain(transportHash);
	});

	it("throws UserConflictError when the unique constraint fires", async () => {
		fake.queueError(new Error("UNIQUE constraint failed: users.email"));

		await expect(
			createUser({
				firstName: "Ada",
				lastName: "Lovelace",
				username: "ada.lovelace",
				email: "ada@example.edu",
				passwordHash: transportHash,
			}),
		).rejects.toBeInstanceOf(UserConflictError);
	});
});

describe("getUserById", () => {
	it("returns a mapped user", async () => {
		fake.queueRows([publicRow]);

		const user = await getUserById("user-1");
		expect(user).toMatchObject({ id: "user-1", firstName: "Ada", username: "ada.lovelace" });
		expectPublicUser(user!);
	});

	it("returns null when missing", async () => {
		fake.queueRows([]);
		await expect(getUserById("missing")).resolves.toBeNull();
	});
});

describe("findByUsernameOrEmail", () => {
	it("binds one normalized identifier to ?1", async () => {
		fake.queueRows([publicRow]);

		await findByUsernameOrEmail(" Ada@Example.EDU ");

		expect(fake.lastCall().sql).toMatch(/\?1/);
		expect(fake.lastCall().sql.match(/\?1/g)?.length).toBe(2);
		expect(fake.lastCall().params).toEqual(["ada@example.edu"]);
	});
});

describe("listUsers", () => {
	it("orders by created_at descending", async () => {
		fake.queueRows([publicRow]);

		const users = await listUsers();
		expect(fake.lastCall().sql).toMatch(/ORDER BY created_at DESC/i);
		expectPublicUser(users[0]);
	});
});

describe("updateUser", () => {
	it("sets updated_at and regenerates the salt when the password changes", async () => {
		fake.queueChanges(1);
		fake.queueRows([publicRow]);
		await createUser({
			firstName: "Ada",
			lastName: "Lovelace",
			username: "ada.lovelace",
			email: "ada@example.edu",
			passwordHash: transportHash,
		});
		const insertSalt = fake.calls.find((call) => /INSERT/i.test(call.sql))?.params[6];

		fake.queueChanges(1);
		fake.queueRows([{ ...publicRow, updated_at: "2026-01-02 00:00:00" }]);
		const updated = await updateUser("user-1", { passwordHash: otherTransportHash });

		const updateCall = fake.calls.find((call) => /UPDATE/i.test(call.sql));
		expect(updateCall?.sql).toMatch(/updated_at/i);
		expect(updateCall?.params[1]).not.toBe(insertSalt);
		expectPublicUser(updated);
	});

	it("throws UserNotFoundError when no row changes", async () => {
		fake.queueChanges(0);

		await expect(updateUser("missing", { firstName: "Ada" })).rejects.toBeInstanceOf(UserNotFoundError);
	});
});

describe("deleteUser", () => {
	it("returns true when a row is deleted and false when nothing matched", async () => {
		fake.queueChanges(1);
		await expect(deleteUser("user-1")).resolves.toBe(true);

		fake.queueChanges(0);
		await expect(deleteUser("missing")).resolves.toBe(false);
	});
});

describe("verifyCredentials", () => {
	it("returns the public user on a match", async () => {
		const stored = await hashPassword(transportHash);
		fake.queueRows([
			{
				...publicRow,
				password_hash: stored.hash,
				password_salt: stored.salt,
				password_iterations: stored.iterations,
			},
		]);

		const user = await verifyCredentials("ada.lovelace", transportHash);
		expect(user).toMatchObject({ id: "user-1", username: "ada.lovelace" });
		expectPublicUser(user!);
	});

	it("returns null for a wrong password", async () => {
		const stored = await hashPassword(transportHash);
		fake.queueRows([
			{
				...publicRow,
				password_hash: stored.hash,
				password_salt: stored.salt,
				password_iterations: stored.iterations,
			},
		]);

		await expect(verifyCredentials("ada.lovelace", otherTransportHash)).resolves.toBeNull();
	});

	it("returns null for an unknown identifier and still derives against a dummy salt", async () => {
		const password = await import("@/lib/password");
		const spy = vi.spyOn(password, "verifyPassword");
		fake.queueRows([]);

		await expect(verifyCredentials("nobody", transportHash)).resolves.toBeNull();
		expect(spy).toHaveBeenCalled();
		spy.mockRestore();
	});
});
