Date created: 2026-09-03
Date last modified: 2026-09-04

# Multiple Choice Question CRUD - Technical PRD

## Overview/Problem

The previous sprint gave QuizMaker an identity layer: a `users` table, a user service, register/login/logout endpoints, and pages. It deliberately stopped there. `/questions` is a stub that says "Question management arrives next sprint," and there is no table in the database that holds a question.

So a teacher can create an account and log in, and then has nothing to do. There is no way to author a multiple-choice question, no way to see the questions the team has already written, and no way to correct or remove one. The shared question bank that motivated the accounts in the first place does not exist yet.

This sprint builds it. Three tables (`mcqs`, `mcq_choices`, `mcq_attempts`), an MCQ service that owns all SQL against them, HTTP endpoints for create/read/update/delete, and a real `/questions` page: a shadcn table listing every question, a Create button, and a per-row three-dot Action menu offering Preview, Edit, and Delete. Create and Edit share one page with Save and Cancel.

---

## Hypothesis

We believe that giving teachers a table of every question plus a single form to create and edit questions and their choices will turn the account they registered into a working shared question bank, which is the first point at which QuizMaker delivers any value at all.

---

## Scope

### In Scope

- A migration creating three tables: `mcqs`, `mcq_choices`, and `mcq_attempts`
- `mcqs` columns: `id`, `name`, `question`, `description` (nullable), `created_by_user_id` (nullable), `created_at`, `updated_at`
- `mcq_choices`: a choice belongs to one MCQ by foreign key, carries its text, an `is_correct` flag, and a 1-based `position`
- Between 2 and 6 choices per MCQ, with exactly one marked correct
- `mcq_attempts`: the table only — schema, foreign keys, and its migration contract test
- `src/lib/services/mcq-service.ts` — the only module that issues SQL against these tables, exposing `createMcq`, `getMcqById`, `listMcqs`, `updateMcq`, `deleteMcq`
- Zod schemas in `src/lib/validation/mcq-schemas.ts`, validating every request body before use
- Five route handlers: `GET`/`POST` on `/api/mcqs`, and `GET`/`PUT`/`DELETE` on `/api/mcqs/[id]`
- `/questions` replaced: a shadcn `Table` of all MCQs with Name, Description, and an Actions column
- The Actions column is a three-vertical-ellipsis `DropdownMenu` with Preview, Edit, and Delete
- Preview opens a dialog that loads the full question, lets the author select a choice, and shows Correct or Incorrect only after that selection — without revealing the answer key up front and without writing back to the database
- Delete asks for confirmation in a `Dialog` before it calls the API
- A Create Multiple Choice Question button on `/questions`
- `/questions/new` and `/questions/[id]/edit`, both rendering one shared `McqForm` with Save and Cancel
- The form starts with two empty choices, allows adding up to six, and allows removing back down to two
- One new shadcn component: `dropdown-menu` (approved by the user)
- Test-driven implementation in **every** phase using **Vitest**, exactly as the identity sprint did. Tests are written first and observed failing; implementation turns them green. Green tests plus that phase's **Done when** list is the signal that the phase is complete.

### Out of Scope

Not built now; expected in a later sprint:

- **An attempts service and attempts endpoints.** The user chose "table and migration only." The schema lands so the next sprint has a target, but no code reads or writes `mcq_attempts` and no row will exist in it when this sprint ends. The original request mentioned attempt-recording endpoints; they were deliberately deferred here.
- **A quiz-taking UI for students.** Preview is an author try-it dialog only: it does not record attempts, and selecting a choice never updates the stored correct answer.
- **Session management, and therefore a populated `created_by_user_id`.** The column exists and is nullable. The service accepts an optional `createdByUserId` so the wiring is ready, but no caller can supply it, so every row written this sprint stores `NULL`. This is the same gap the identity PRD flagged as its top follow-up, and it is still open.
- **Route protection.** `/questions`, `/questions/new`, `/questions/[id]/edit`, and all five endpoints are reachable by anyone with the URL. Unchanged from last sprint, and unfixable without sessions.
- **Ownership and permissions.** Any caller can edit or delete any question. There is no author check because there is no authenticated author.
- Pagination, search, sorting, and filtering on the question list
- Reordering choices by drag, or any choice ordering beyond the order the rows appear in the form
- Rich text, images, or code blocks in a question or a choice
- Bulk delete, duplicate, import, or export
- Optimistic UI updates and toast notifications
- Question categories, tags, difficulty, or TEKS alignment

### Cut

Considered during planning and deliberately removed:

- **Adding a session so `created_by_user_id` could be populated** - Proposed and declined. It is the technically correct fix and it is a sprint's worth of work on its own. Deferring it is a conscious trade, not an oversight; the consequences are listed under Risks.
- **The `sonner` toast component** - Would add an npm dependency for feedback that inline text already provides. Not approved. Errors render inline through `FieldError`, matching the auth forms.
- **The shadcn `alert-dialog` component** - `dialog` is already installed and is enough for a delete confirmation. Not approved, and a second dialog primitive would be redundant.
- **The shadcn `textarea` component** - Not approved. Use a plain `<textarea>` carrying the same Tailwind token classes as `Input`. It is a native element with no dependency cost.
- **The shadcn `radio-group` component** - Initially declined in favor of native radios; later approved and used for both the create/edit correct-answer control and selectable Preview choices.
- **`react-hook-form`** - `.cursor/rules/shadcn.mdc` says to ask first, and the auth forms already establish plain `useState` plus manual validation. Introducing a second form idiom in the same codebase costs more than it saves.
- **Server Actions instead of route handlers** - `.cursor/rules/nextjs.mdc` prefers them, but the identity sprint set the HTTP-endpoint pattern and the user asked for endpoints again. Consistency wins.
- **Diff-based choice updates** - Editing an MCQ deletes its choices and reinserts them. Diffing would keep choice IDs stable but costs real complexity to keep positions contiguous. Delete-and-replace is correct and small; see Database Schema for how attempt history is protected from it.
- **A separate migration per table** - Three tables that reference each other, created in one phase, belong in one atomically applied file with one schema contract test.
- **Soft deletes** - Same reasoning as the identity sprint. Hard delete now; a later migration can add `deleted_at` if anything needs it.
- **Renaming `/questions` to `/mcqs`** - `/questions` is the post-login landing target asserted by three existing Phase 4 auth tests. Renaming it would churn passing tests for no user-visible benefit.

---

## Technical Requirements

### Database Schema

D1 is already configured. `wrangler.jsonc` binds `DB` to `ai-sprint-quiz-db` with `migrations_dir` `migrations`, and `src/lib/db.ts` exposes `getDb()`. **Do not create a second database, a second binding, or a second accessor.** This sprint adds one migration on top of `0001_create_users_table.sql`.

Create it with:

```bash
npx wrangler d1 migrations create ai-sprint-quiz-db create_mcq_tables
```

That produces `migrations/0002_create_mcq_tables.sql`. Write all three tables into it, parents before children:

```sql
CREATE TABLE mcqs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  question TEXT NOT NULL,
  description TEXT,
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_mcqs_created_at ON mcqs (created_at);
CREATE INDEX idx_mcqs_created_by_user_id ON mcqs (created_by_user_id);

CREATE TABLE mcq_choices (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  mcq_id TEXT NOT NULL REFERENCES mcqs(id) ON DELETE CASCADE,
  choice_text TEXT NOT NULL,
  is_correct INTEGER NOT NULL DEFAULT 0 CHECK (is_correct IN (0, 1)),
  position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 6),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_mcq_choices_mcq_id ON mcq_choices (mcq_id);
CREATE UNIQUE INDEX idx_mcq_choices_mcq_position ON mcq_choices (mcq_id, position);

CREATE TABLE mcq_attempts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  mcq_id TEXT NOT NULL REFERENCES mcqs(id) ON DELETE CASCADE,
  mcq_choice_id TEXT REFERENCES mcq_choices(id) ON DELETE SET NULL,
  selected_choice_text TEXT NOT NULL,
  is_correct INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_mcq_attempts_mcq_id ON mcq_attempts (mcq_id);
CREATE INDEX idx_mcq_attempts_user_id ON mcq_attempts (user_id);
```

Apply **locally only**:

```bash
npx wrangler d1 migrations apply ai-sprint-quiz-db --local
```

Never pass `--remote`. Remote schema changes are the user's decision.

Column notes:

| Column                                     | Purpose                                                                                                                                                                                                                                                          |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mcqs.id`                                  | Same opaque 32-character hex scheme as `users.id`. Safe to put in a URL, and `/questions/[id]/edit` does exactly that.                                                                                                                                           |
| `mcqs.name`                                | Short label shown in the list table. Not unique — two teachers may reasonably both write "Photosynthesis". Trimmed by the service.                                                                                                                               |
| `mcqs.question`                            | The question text actually posed. Separate from `name` because the label a teacher scans in a list is rarely the sentence they want a student to read.                                                                                                           |
| `mcqs.description`                         | Optional teacher-facing note. Nullable, and the only nullable text column here. The service stores `NULL` rather than `''` for an empty input so "not written" and "written as blank" do not become the same thing.                                              |
| `mcqs.created_by_user_id`                  | Nullable, `REFERENCES users(id) ON DELETE SET NULL`. **Always `NULL` this sprint** — there is no session, so nothing can identify the author. Deleting a teacher must not delete the questions the team relies on, hence `SET NULL` rather than `CASCADE`.        |
| `mcq_choices.mcq_id`                       | `ON DELETE CASCADE`, so deleting a question takes its choices with it. The service still deletes choices explicitly; see the Important Notes on foreign key enforcement.                                                                                          |
| `mcq_choices.choice_text`                  | Named `choice_text` rather than `text`, because `text` is an SQL type name and reads badly in a `SELECT` list.                                                                                                                                                   |
| `mcq_choices.is_correct`                   | SQLite has no boolean. `INTEGER` constrained to 0 or 1, mapped to a real `boolean` by the service so no caller ever sees a 0.                                                                                                                                    |
| `mcq_choices.position`                     | 1-based display order, `CHECK (position BETWEEN 1 AND 6)`. Unique per `mcq_id`, so two choices cannot claim the same slot. The **minimum** of two choices cannot be expressed as a table constraint and is enforced by Zod instead.                               |
| `mcq_attempts.mcq_choice_id`               | Nullable with `ON DELETE SET NULL`, **not** `CASCADE`. Editing an MCQ deletes and reinserts its choices; with `CASCADE` that edit would silently destroy every attempt ever recorded against the question.                                                        |
| `mcq_attempts.selected_choice_text`        | A snapshot of what the student actually clicked, taken at attempt time. Beyond the literal request, and worth the one column: without it, an edit that rewords a choice rewrites history, and a deleted choice leaves an attempt pointing at nothing.             |
| `mcq_attempts.is_correct`                  | Also a snapshot. Whether the answer was right is a fact about the moment it was given. If a teacher later fixes which choice is correct, past attempts must not silently change their verdict.                                                                    |
| `updated_at`                               | SQLite has no automatic update trigger. The service sets it explicitly on every update, exactly as the user service does.                                                                                                                                        |

### MCQ Service

`src/lib/services/mcq-service.ts` is the only module that issues SQL against `mcqs`, `mcq_choices`, and `mcq_attempts`. Route handlers call it; they never touch `env.DB` or `getDb()` directly. This mirrors `user-service.ts` exactly — same import, same numbered placeholders, same `all()` plus `results[0]` reads, same custom error classes, same snake_case row type mapped to a camelCase public type.

```typescript
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
```

| Method       | Signature                                              | Behavior                                                                                                                                                                                     |
| ------------ | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createMcq`  | `(input: CreateMcqInput) => Promise<McqWithChoices>`   | Generates the id, trims text, normalizes empty `description` to `NULL`, assigns `position` from the array index, writes the MCQ and every choice in one `db.batch()`, reads the row back.     |
| `getMcqById` | `(id: string) => Promise<McqWithChoices \| null>`      | Two reads: the MCQ, then its choices `ORDER BY position ASC`. Returns `null` when the MCQ does not exist.                                                                                    |
| `listMcqs`   | `() => Promise<Mcq[]>`                                 | `ORDER BY created_at DESC`. Deliberately does **not** load choices — the list table shows name and description only, and N+1 queries for data nothing renders is waste.                       |
| `updateMcq`  | `(id, patch: UpdateMcqInput) => Promise<McqWithChoices>` | Partial update of `name`, `question`, `description`. Sets `updated_at`. When `choices` is present, deletes all existing choices and reinserts the new set. Throws `McqNotFoundError`.       |
| `deleteMcq`  | `(id: string) => Promise<boolean>`                     | Deletes the choices, then the MCQ. Returns `false` when no MCQ row matched.                                                                                                                  |

`CreateMcqInput`: `{ name, question, description?, createdByUserId?, choices: ChoiceInput[] }`, where `ChoiceInput` is `{ text: string; isCorrect: boolean }`. Position is the array index plus one; callers never send it.

`UpdateMcqInput`: every field optional, including `choices`. Omitting `choices` leaves them untouched, which is what makes a name-only edit cheap.

Two conventions carried over from the user service, and one that is new:

- **Validation lives in the route layer, not the service.** `user-service.ts` trusts its typed input and so does this one. The 2-to-6 range and the exactly-one-correct rule are enforced by Zod in `mcq-schemas.ts`. Do not duplicate them in the service; a rule implemented twice is a rule that will disagree with itself.
- **Errors are custom classes.** `McqNotFoundError` for a missing row. There is no conflict error — nothing here has a unique constraint that a user can collide with.
- **Multi-statement writes go through `db.batch()`**, which D1 wraps in a transaction. Creating an MCQ with six choices is seven statements; run sequentially, a failure halfway through leaves a question with three choices and no way to notice. `createFakeD1` does not implement `batch()` today — Phase 1 adds it, test-first, before the service needs it.

### API Endpoints

Two route files under `src/app/api/mcqs/`. Every handler parses the body with a Zod schema before using any field, and returns the same error shape the auth endpoints use:

```json
{ "error": { "message": "Human readable message", "fields": { "name": "Required" } } }
```

`fields` is present only on validation errors. Reuse `toFieldErrors` from `src/lib/validation/http.ts`; do not write a second version of it.

Next.js 16 delivers dynamic route params as a Promise. Every `[id]` handler must await them:

```typescript
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
}
```

#### GET /api/mcqs

**Request Body:** none

**Response:**

- Success (200): `{ "mcqs": [{ "id", "name", "question", "description", "createdByUserId", "createdAt", "updatedAt" }] }`, newest first
- Error (500): `Unable to load questions`

#### POST /api/mcqs

**Request Body:**

```json
{
  "name": "Photosynthesis basics",
  "question": "Which gas do plants absorb during photosynthesis?",
  "description": "Covers the inputs of the light-dependent reaction.",
  "choices": [
    { "text": "Carbon dioxide", "isCorrect": true },
    { "text": "Oxygen", "isCorrect": false }
  ]
}
```

`description` is optional. `choices` must have between 2 and 6 entries with exactly one `isCorrect: true`.

**Response:**

- Success (201): `{ "mcq": { ...mcq, "choices": [...] } }`
- Error (400): Validation failure, with per-field messages
- Error (500): `Unable to create question`

#### GET /api/mcqs/[id]

**Response:**

- Success (200): `{ "mcq": { ...mcq, "choices": [...] } }` with choices ordered by position
- Error (404): `Question not found`
- Error (500): `Unable to load question`

#### PUT /api/mcqs/[id]

**Request Body:** the same shape as `POST`, with every field optional. Sending `choices` replaces the whole set; omitting it leaves them alone. A `choices` array that is present must still satisfy the 2-to-6 and one-correct rules.

**Response:**

- Success (200): `{ "mcq": { ...mcq, "choices": [...] } }`
- Error (400): Validation failure
- Error (404): `Question not found`
- Error (500): `Unable to update question`

#### DELETE /api/mcqs/[id]

**Request Body:** none

**Response:**

- Success (200): `{ "success": true }`
- Error (404): `Question not found`
- Error (500): `Unable to delete question`

Deleting an already-deleted question returns 404 rather than a cheerful 200. The client is telling us it believes the row exists; if it does not, that belief is worth correcting.

### User Interface Requirements

Built from `src/components/ui/`: `table`, `button`, `card`, `field`, `input`, `label`, `dialog`, and the newly added `dropdown-menu`. Install that one with:

```bash
npx shadcn@latest add @shadcn/dropdown-menu
```

Two elements have no approved shadcn component and use native elements instead:

- **Multi-line text** (`question`, `description`) is a plain `<textarea>` carrying the same Tailwind token classes as `Input`.
- **The correct-answer selector** is a native `<input type="radio">` with a shared `name`, which enforces "exactly one" in the browser and gives arrow-key navigation for free.

Use theme tokens (`bg-background`, `text-muted-foreground`, `border-destructive`) rather than hard-coded colors, and merge classes with `cn()`.

#### Question bank (`/questions`)

Replaces the stub. A Server Component that calls `listMcqs()` directly — the App Router idiom, and it avoids a client round trip just to paint the first screen. Wrap the call in `try`/`catch` and render an inline error card on failure, so a missing D1 binding under `npm run dev` shows a readable message instead of the Next.js error overlay.

- Heading, the existing `LogoutButton`, and a **Create Multiple Choice Question** button linking to `/questions/new`
- A shadcn `Table` with columns **Name**, **Description**, and **Actions**
- Description renders `—` when null, truncated to one line
- Empty state when there are no questions: a short line of copy and the same Create button, not an empty table body
- The table itself is `McqTable`, a `'use client'` component, because the Action menu and the delete flow need state

#### Actions column

- Trigger: an icon-only `Button` (`variant="ghost"`, `size="icon"`) holding `EllipsisVertical` from `lucide-react`, with an accessible name of `Actions for {name}` so tests and screen readers can tell two rows apart
- `DropdownMenu` items:
  - **Preview** — opens `PreviewMcqDialog` for that row
  - **Edit** — `router.push('/questions/{id}/edit')`
  - **Delete** — opens the confirmation dialog, styled with `text-destructive`

#### Preview dialog

`PreviewMcqDialog` loads `GET /api/mcqs/{id}` when opened. It is an author try-it surface, not a student quiz:

- Choices render as a `RadioGroup` with **no** Correct/Incorrect badge until the author selects one
- After a selection, only that choice shows **Correct** or **Incorrect**
- A wrong selection does **not** reveal which other choice is the answer key
- Selection is local React state only — preview never `PUT`s or otherwise changes the stored correct answer
- Closing the dialog clears the selection so the next open starts blank again

#### Delete confirmation

A `Dialog` (`DeleteMcqDialog`), not a bare `window.confirm`:

- Names the question being deleted so a misclick on the wrong row is visible before it is irreversible
- Cancel closes with no request sent
- Delete sends `DELETE /api/mcqs/{id}`, and on success closes the dialog and calls `router.refresh()` to re-run the server component
- On failure, keeps the dialog open and shows the error inline. Closing a dialog on a failed request tells the user it worked.

#### Create and Edit (`/questions/new` and `/questions/[id]/edit`)

Both are Server Components rendering the same `'use client'` `McqForm`. `/questions/new` renders it with no initial value; `/questions/[id]/edit` awaits `params`, calls `getMcqById(id)`, and calls `notFound()` when the result is `null`.

Fields:

| Field       | Control                | Validation                                                     |
| ----------- | ---------------------- | ---------------------------------------------------------------- |
| Name        | `Input`                | Required, 1–200 characters after trimming                        |
| Question    | `<textarea>`           | Required, 1–2000 characters after trimming                       |
| Description | `<textarea>`           | Optional, max 2000 characters                                    |
| Choices     | repeating rows         | 2–6 rows, each 1–500 characters, exactly one marked correct      |

Each choice row holds a radio for "correct", an `Input` for the text, and a Remove button.

Behavior:

- Opens with two empty choice rows on create, or the saved choices in position order on edit
- **Add choice** appends a row and is disabled at six
- **Remove** is disabled on every row when only two remain, so the form cannot reach an invalid state
- Removing the row currently marked correct clears the selection; Save then reports that a correct answer is required rather than silently picking one
- Client validates first, then `POST`s to `/api/mcqs` or `PUT`s to `/api/mcqs/{id}`
- On success, `router.push('/questions')`
- On 400, render the per-field messages the server returned. The server is the authority even though the client validated first.
- **Cancel** returns to `/questions` without saving and sends no request
- Submit is disabled with a pending label (`Saving...`) while the request is in flight

---

## Implementation Phases

Five phases in order: schema and test harness, then service, then HTTP, then pages, then Workers preview verification. All five are COMPLETED.

Already in the repo and **not** to be recreated: the D1 database and `DB` binding, `src/lib/db.ts`, `src/test-support/fake-d1.ts`, `src/lib/validation/http.ts`, and the Vitest harness. This sprint extends `fake-d1.ts` with `batch()` support and adds `mcq-schemas.ts` beside the existing `auth-schemas.ts`.

### Test-driven rule (every phase)

Each phase is red → green → done, the same discipline the identity sprint used.

1. **Red.** Write the Vitest files listed in that phase's **TDD plan**. Run `npm test`. The new tests must fail for a real reason: missing module, missing column, wrong status code. If a new test passes before any production code exists, it is not testing behavior — rewrite it.
2. **Green.** Implement only enough production code to make *that phase's* new tests pass. Do not implement the next phase while turning these green.
3. **Done.** The phase is complete only when `npm test` is green, including the whole inherited 73-test suite, and that phase's **Done when** list is checked.

Conventions, unchanged from the identity sprint:

- Framework: **Vitest**. `npm test` is the phase gate; `npm run test:watch` while implementing.
- Colocate: `foo.ts` is tested by `foo.test.ts`, `Foo.tsx` by `Foo.test.tsx`.
- Server tests run on the `node` project; `*.test.tsx` files run on the `jsdom` project automatically. No docblock is needed — `vitest.config.mts` already splits them by extension.
- Mock `@/lib/db` with `createFakeD1()`. Never hit real D1, a real network, or a real Workers binding from a unit test.
- Route tests mock `@/lib/services/mcq-service`. Component tests mock `next/navigation` and `global.fetch`.
- Assert observable behavior. Name tests so a failure message explains what broke.

### Phase 1: Schema and Test Harness - COMPLETED

**Objective**: The three tables exist in the local database, and `createFakeD1` can stand in for the batched writes the service is about to need.

**TDD plan (write first, expect red):**

`src/test-support/fake-d1.test.ts` — extend the existing file.

| Test                                      | Asserts                                                                     | Why it is red first             |
| ----------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------- |
| `batch()` records every statement         | `batch([a, b])` appends both statements to `calls` in order                 | `batch()` currently rejects     |
| `batch()` returns one result per statement | resolves to an array the same length as the input                          | not implemented                 |
| `batch()` consumes the queue in order     | rows queued before the call come back on the matching statement             | not implemented                 |
| `queueError` rejects the whole batch      | a queued error makes `batch()` reject, and no later statement resolves      | not implemented                 |

`migrations/0002_create_mcq_tables.test.ts` — reads the SQL from disk, exactly as the users migration test does. Does **not** apply the migration and does **not** talk to D1.

| Test                              | Asserts                                                                                                       | Why it is red first        |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------- |
| migration file exists             | reading `0002_create_mcq_tables.sql` succeeds                                                                 | file not created yet       |
| creates all three tables          | SQL contains `CREATE TABLE mcqs`, `CREATE TABLE mcq_choices`, `CREATE TABLE mcq_attempts`                     | empty or missing file      |
| `mcqs` columns                    | declares `id`, `name`, `question`, `description`, `created_by_user_id`, `created_at`, `updated_at`            | columns not written        |
| `created_by_user_id` is nullable  | the column is **not** declared `NOT NULL`, and references `users(id)`                                         | guards the deferred-session decision at the schema layer |
| `mcq_choices` foreign key         | `mcq_id` references `mcqs(id)` with `ON DELETE CASCADE`                                                       | constraint missing         |
| choice position is bounded        | a `CHECK` restricting `position` to 1 through 6                                                               | constraint missing         |
| choice position is unique per MCQ | a unique index over `(mcq_id, position)`                                                                      | index missing              |
| `mcq_attempts` records the choice | declares `mcq_choice_id`, `selected_choice_text`, and `is_correct`                                            | columns not written        |
| attempts survive a choice edit    | `mcq_choice_id` uses `ON DELETE SET NULL`, not `CASCADE`                                                      | this is the constraint most likely to be written wrong, and the bug is silent |

**Tasks**:

1. Write the new `fake-d1` batch tests. Run `npm test`. They must fail.
2. Implement `batch()` in `src/test-support/fake-d1.ts` until they are green. Keep the existing `prepare().bind().all()` recording behavior unchanged — the 73 inherited tests depend on it.
3. Write `migrations/0002_create_mcq_tables.test.ts`. Run `npm test`. The schema tests must fail.
4. Create the migration with `npx wrangler d1 migrations create ai-sprint-quiz-db create_mcq_tables` and write the SQL from Database Schema into it.
5. Re-run `npm test`. The schema tests must go green. If they are still red, fix the SQL, not the tests, unless a test was asserting the wrong thing.
6. Apply locally: `npx wrangler d1 migrations apply ai-sprint-quiz-db --local`. Never use `--remote`. Confirm with `npx wrangler d1 migrations list ai-sprint-quiz-db --local`.
7. Install the one approved component: `npx shadcn@latest add @shadcn/dropdown-menu`. Commit the generated file without hand-editing it.

**Done when**:

- [x] Phase 1 Vitest tests were observed failing, then passing
- [x] `npm test` is green, including all 73 inherited tests
- [x] `createFakeD1().db.batch()` records statements and honors the queue
- [x] `migrations/0002_create_mcq_tables.sql` contains every column, index, and constraint in Database Schema
- [x] The migration is applied locally and `migrations list --local` shows it
- [x] The remote database was not touched
- [x] `src/components/ui/dropdown-menu.tsx` exists and no other dependency was added

**Deliverables**:

- `migrations/0002_create_mcq_tables.sql` and `migrations/0002_create_mcq_tables.test.ts`
- `src/test-support/fake-d1.ts` with `batch()`, and its extended test file
- `src/components/ui/dropdown-menu.tsx`

### Phase 2: MCQ Service and Validation - COMPLETED

**Objective**: Server code can create, read, update, and delete a multiple-choice question and its choices. No HTTP and no pages yet.

**TDD plan (write first, expect red):**

`src/lib/validation/mcq-schemas.test.ts`

| Test                                        | Asserts                                                                          |
| ------------------------------------------- | ---------------------------------------------------------------------------------- |
| accepts a valid create body                 | `createMcqSchema.safeParse` succeeds with name, question, and two choices        |
| description is optional                     | a body without `description` parses                                              |
| rejects fewer than two choices              | one choice fails                                                                 |
| rejects more than six choices               | seven choices fail                                                               |
| rejects zero correct choices                | all `isCorrect: false` fails, and the message names the problem                  |
| rejects more than one correct choice        | two `isCorrect: true` fails                                                      |
| rejects blank name, question, or choice text | whitespace-only strings fail after trimming                                     |
| update schema allows a partial body         | `{ name: "New" }` parses without `choices`                                       |
| update schema still bounds a present `choices` | `{ choices: [one] }` fails                                                     |

`src/lib/services/mcq-service.test.ts` — mock `@/lib/db` with `createFakeD1()`.

| Test                                                  | Asserts                                                                                     |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `createMcq` writes the MCQ and its choices in one batch | one `batch()` call containing an `INSERT INTO mcqs` plus one insert per choice               |
| `createMcq` assigns positions from array order        | bound positions are 1 and 2 for two choices, in the order supplied                          |
| `createMcq` trims text and stores null for empty description | bound `description` is `null`, not `""`                                                |
| `createMcq` returns the created MCQ with its choices  | queued read-back rows map to `McqWithChoices`                                               |
| `createMcq` stores `createdByUserId` as null when absent | the bound value is `null` (the deferred-session contract, asserted rather than assumed)   |
| `getMcqById` returns the MCQ with choices in position order | SQL for choices contains `ORDER BY position`                                          |
| `getMcqById` returns null when missing                | empty results, and no choices query is issued                                               |
| `getMcqById` maps `is_correct` to a boolean           | a row with `is_correct: 1` produces `isCorrect: true`, never `1`                            |
| `listMcqs` orders newest first                        | SQL contains `ORDER BY created_at DESC`                                                     |
| `listMcqs` does not query choices                     | exactly one recorded call                                                                   |
| `updateMcq` sets `updated_at`                         | the update SQL assigns `updated_at`                                                         |
| `updateMcq` replaces choices when they are supplied   | the batch deletes existing choices before inserting the new set                             |
| `updateMcq` leaves choices alone when omitted         | no delete against `mcq_choices` is recorded                                                 |
| `updateMcq` throws `McqNotFoundError` when no row changes | fake reports `changes: 0`                                                               |
| `deleteMcq` removes choices and the MCQ               | both deletes recorded                                                                       |
| `deleteMcq` returns false when nothing matched        | `changes: 0`                                                                                |
| every query uses numbered placeholders                | no recorded SQL contains a bare `?` that is not followed by a digit                         |

Run `npm test`. These must fail. Then implement.

**Tasks**:

1. Add `src/lib/validation/mcq-schemas.ts` (`createMcqSchema`, `updateMcqSchema`, shared `choicesSchema` with the 2-to-6 and one-correct refinements) until its tests are green. Use the installed `zod`; do not add a second validation library.
2. Add `src/lib/services/mcq-service.ts` with `createMcq`, `getMcqById`, `listMcqs`, `updateMcq`, `deleteMcq`. All SQL against the three tables goes here. Reuse the `newId()` hex pattern from `user-service.ts`.
3. Re-run `npm test`. Do not start Phase 3 while any Phase 2 test is red.

**Done when**:

- [x] Phase 2 Vitest tests were observed failing, then passing
- [x] `npm test` is green for the whole suite
- [x] Each of the five service methods has at least one passing test
- [x] A create with six choices produces six rows with positions 1 through 6
- [x] Zod rejects fewer than two choices, more than six, and any count of correct answers other than one
- [x] `isCorrect` is a boolean on every returned choice
- [x] No SQL is issued against these tables from outside the service

**Deliverables**:

- `src/lib/validation/mcq-schemas.ts` and `mcq-schemas.test.ts`
- `src/lib/services/mcq-service.ts` and `mcq-service.test.ts`

### Phase 3: MCQ Endpoints - COMPLETED

**Objective**: Five HTTP endpoints exist, validate input, and delegate to the MCQ service.

**TDD plan (write first, expect red):**

Call the exported handler with a real `Request`, and pass `{ params: Promise.resolve({ id }) }` for the dynamic routes. Mock `@/lib/services/mcq-service` so no handler under test opens D1.

`src/app/api/mcqs/route.test.ts`

| Test                                    | Asserts                                                                        |
| --------------------------------------- | -------------------------------------------------------------------------------- |
| `GET` returns 200 with the list         | status 200; body `{ mcqs: [...] }`                                             |
| `GET` returns an empty array, not 404   | no questions yields `{ mcqs: [] }` at 200                                      |
| `GET` returns 500 when the service throws | status 500; `Unable to load questions`; the thrown message is not in the body |
| `POST` returns 201 on a valid body      | status 201; body `{ mcq: { ...choices } }`                                     |
| `POST` passes the parsed body through   | `createMcq` received the trimmed name, question, and choices                   |
| `POST` returns 400 on a missing name    | status 400; `error.fields.name` is set                                         |
| `POST` returns 400 on one choice        | status 400                                                                     |
| `POST` returns 400 on seven choices     | status 400                                                                     |
| `POST` returns 400 on no correct choice | status 400                                                                     |
| `POST` returns 400 on malformed JSON    | a non-JSON body is caught, not thrown                                          |
| `POST` returns 500 on unexpected errors | status 500; `Unable to create question`                                        |

`src/app/api/mcqs/[id]/route.test.ts`

| Test                                        | Asserts                                                     |
| ------------------------------------------- | ------------------------------------------------------------- |
| `GET` returns 200 with the MCQ and choices  | status 200; body `{ mcq: { choices: [...] } }`              |
| `GET` awaits the params promise             | `getMcqById` called with the id from the resolved params    |
| `GET` returns 404 when the service returns null | status 404; `Question not found`                        |
| `PUT` returns 200 on a valid partial body   | status 200; `updateMcq` called with only the sent fields    |
| `PUT` returns 400 on an invalid choice set  | status 400                                                  |
| `PUT` returns 404 on `McqNotFoundError`     | status 404                                                  |
| `PUT` returns 500 on unexpected errors      | status 500; `Unable to update question`                     |
| `DELETE` returns 200 with `{ success: true }` | status 200                                                |
| `DELETE` returns 404 when nothing matched   | service returns `false`; status 404                         |
| `DELETE` returns 500 on unexpected errors   | status 500; `Unable to delete question`                     |

Run `npm test`. These must fail. Then implement.

**Tasks**:

1. Add `src/app/api/mcqs/route.ts` with `GET` and `POST` until its tests are green.
2. Add `src/app/api/mcqs/[id]/route.ts` with `GET`, `PUT`, and `DELETE` until its tests are green. Await `params` in every one.
3. Map errors consistently: 400 validation, 404 missing, 500 everything else. Log the error object; never log the request body.
4. Reuse `toFieldErrors` from `src/lib/validation/http.ts`. Do not write a second copy.
5. Re-run `npm test`. Do not start Phase 4 while any Phase 3 test is red.

**Done when**:

- [x] Phase 3 Vitest tests were observed failing, then passing
- [x] `npm test` is green for the whole suite
- [x] All five endpoints return their documented success status
- [x] An invalid choice count returns 400 with a field message, from both `POST` and `PUT`
- [x] A missing id returns 404 from `GET`, `PUT`, and `DELETE`
- [x] No handler returns an internal error message to the client

**Deliverables**:

- `src/app/api/mcqs/route.ts` and `route.test.ts`
- `src/app/api/mcqs/[id]/route.ts` and `route.test.ts`

### Phase 4: Pages and Components - COMPLETED

**Objective**: A teacher can see every question in a table, create one, edit one, and delete one through the browser.

**TDD plan (write first, expect red):**

Testing Library and `userEvent`. `*.test.tsx` files run on the jsdom project automatically. Mock `next/navigation` and `global.fetch`. Query by role and accessible name.

`src/components/mcq/McqTable.test.tsx`

| Test                                              | Asserts                                                                       |
| ------------------------------------------------- | ------------------------------------------------------------------------------- |
| renders a row per question                        | two questions produce two rows with their names and descriptions              |
| renders an em dash for a null description         | the cell is not blank                                                         |
| renders an empty state when there are no questions | the empty copy and a Create control are visible, and no table body rows      |
| the Action menu opens on click                    | Edit and Delete Multiple Choice Question are both visible                     |
| each row's menu trigger is distinguishable        | accessible names include the question name, so two rows are not ambiguous     |
| Edit navigates to the edit page                   | `router.push` called with `/questions/{id}/edit`                              |
| Delete opens the confirmation dialog              | the dialog names the question; `fetch` has not been called                    |

`src/components/mcq/DeleteMcqDialog.test.tsx`

| Test                                     | Asserts                                                     |
| ---------------------------------------- | ------------------------------------------------------------- |
| Cancel closes without a request          | `fetch` not called                                          |
| Confirm sends DELETE to the right URL    | `fetch` called with `/api/mcqs/{id}` and method `DELETE`    |
| success refreshes the list               | `router.refresh` called                                     |
| failure keeps the dialog open with an error | error text visible; `router.refresh` not called          |

`src/components/mcq/McqForm.test.tsx`

| Test                                              | Asserts                                                                     |
| ------------------------------------------------- | ----------------------------------------------------------------------------- |
| starts with two empty choice rows                 | exactly two choice text inputs on create                                    |
| pre-fills from an existing MCQ                    | name, question, description, and choices render in position order           |
| the saved correct choice is selected              | the matching radio is checked                                               |
| Add choice appends a row                          | three inputs after one click                                                |
| Add choice is disabled at six                     | the control is disabled once six rows exist                                 |
| Remove is disabled when only two rows remain      | both remove controls are disabled                                           |
| Remove deletes the right row                      | the remaining input holds the other row's text, not a shifted value         |
| submitting with no correct choice does not POST   | `fetch` not called; an error is visible                                     |
| submitting with a blank name does not POST        | `fetch` not called; the name error is visible                               |
| a valid create POSTs to `/api/mcqs`               | body JSON has name, question, and choices with one `isCorrect: true`        |
| a valid edit PUTs to `/api/mcqs/{id}`             | correct method and URL                                                      |
| success navigates to `/questions`                 | `router.push('/questions')`                                                 |
| a 400 renders the server's field messages         | the message returned in `error.fields.name` is visible                      |
| Cancel navigates away without a request           | `fetch` not called; router called with `/questions`                         |
| submit is disabled with a pending label in flight | button disabled until `fetch` resolves                                      |

Run `npm test`. These must fail. Then implement.

**Tasks**:

1. Build `McqTable` until its tests are green. Client component, shadcn `Table` plus `DropdownMenu`.
2. Build `DeleteMcqDialog` until its tests are green. `Dialog`, `DELETE`, then `router.refresh()`.
3. Build `McqForm` until its tests are green. Shared by create and edit; the presence of an initial MCQ decides `POST` versus `PUT`.
4. Replace `src/app/questions/page.tsx`: Server Component, `listMcqs()` in a `try`/`catch`, heading, `LogoutButton`, Create button, `McqTable`.
5. Add `src/app/questions/new/page.tsx` and `src/app/questions/[id]/edit/page.tsx`. The edit page awaits `params`, calls `getMcqById`, and calls `notFound()` on `null`.
6. Re-run `npm test`. The whole suite, including the inherited auth tests, must stay green.
7. Run `npm run lint` and `npm run build`.

**Done when**:

- [x] Phase 4 Vitest tests were observed failing, then passing
- [x] `npm test` is green for the full suite
- [x] `/questions` lists every question with Name, Description, and Actions
- [x] The three-dot menu opens and offers Edit and Delete Multiple Choice Question
- [x] Create, Save, Cancel, Edit, and Delete each behave as specified in unit tests
- [x] The form cannot be driven below two or above six choices
- [x] `npm run lint` and `npm run build` succeed

**Deliverables**:

- `src/components/mcq/McqTable.tsx`, `DeleteMcqDialog.tsx`, `McqForm.tsx` and their `*.test.tsx` files
- `src/app/questions/page.tsx` (rewritten), `src/app/questions/new/page.tsx`, `src/app/questions/[id]/edit/page.tsx`

### Phase 5: Workers Preview Verification - COMPLETED

**Objective**: Confirm the real Workers and D1 path end to end. Preview UX polish (try-it without revealing the key) landed as a verified follow-up after the browser pass; no schema or API changes.

**TDD plan:** None for the Workers observation itself. The Preview try-it tweak has Vitest coverage in `PreviewMcqDialog.test.tsx`. `npm run dev` does not load D1 bindings on Windows, so it cannot verify the end-to-end path.

**Tasks**:

1. Run `npm run preview`. Log in, land on `/questions`, and confirm the empty state renders.
2. Create a question with two choices. Confirm it appears in the table.
3. Edit it: change the name, add choices up to six, change which one is correct. Confirm the changes persist across a reload.
4. Edit it again down to two choices and confirm no orphaned `mcq_choices` rows remain.
5. Delete it through the three-dot menu and confirm the row disappears and the choices are gone from the database.
6. Query the local database directly to confirm `created_by_user_id` is `NULL` and `mcq_attempts` is empty — both are expected this sprint, and confirming it prevents a later false bug report.
7. Confirm Preview: no answer key until a choice is selected; Correct/Incorrect feedback afterward; selection does not persist to D1.

**Done when**:

- [x] Create, list, edit, and delete all observed working under `npm run preview` (Workers API + browser, 2026-09-03 / 2026-09-04)
- [x] Choices persist in position order with exactly one correct (edit to 6 positions `1..6` with correct `A3`, then down to 2)
- [x] Deleting a question leaves no `mcq_choices` rows behind (`leftover_phase5_choices = 0`, `orphan_choices = 0`)
- [x] `created_by_user_id` is `NULL` on every row, as designed
- [x] `mcq_attempts` exists and is empty (`attempt_count = 0`)
- [x] Preview hides the answer key until a selection, then shows Correct/Incorrect without writing (user verified 2026-09-04)
- [x] Acceptance Criteria checked off from observed behavior, not from code inspection

**Deliverables**:

- Updated Acceptance Criteria and Current Status from the observed preview run (2026-09-04)
- Final Preview try-it behavior documented and implemented in `PreviewMcqDialog`

---

## Technical Implementation Details

### Key Files

| File                                            | Purpose                                                       | Status              |
| ----------------------------------------------- | --------------------------------------------------------------- | ------------------- |
| `migrations/0002_create_mcq_tables.sql`         | Creates `mcqs`, `mcq_choices`, `mcq_attempts`                 | Created in Phase 1  |
| `migrations/0002_create_mcq_tables.test.ts`     | Vitest schema contract for the migration                      | Created in Phase 1 (wrote first) |
| `src/test-support/fake-d1.ts`                   | Extended with `batch()` for transactional writes              | Created in Phase 1  |
| `src/components/ui/dropdown-menu.tsx`           | Generated by shadcn; do not hand-edit                         | Created in Phase 1  |
| `src/lib/validation/mcq-schemas.ts`             | Zod schemas, including the 2-to-6 and one-correct rules       | Created in Phase 2  |
| `src/lib/validation/mcq-schemas.test.ts`        | Vitest: accept valid bodies, reject invalid choice sets       | Created in Phase 2 (wrote first) |
| `src/lib/services/mcq-service.ts`               | All SQL against the three MCQ tables                          | Created in Phase 2  |
| `src/lib/services/mcq-service.test.ts`          | Vitest: CRUD using `createFakeD1()`                           | Created in Phase 2 (wrote first) |
| `src/app/api/mcqs/route.ts`                     | `GET` list, `POST` create                                     | Created in Phase 3  |
| `src/app/api/mcqs/[id]/route.ts`                | `GET` one, `PUT` update, `DELETE` remove                      | Created in Phase 3  |
| `src/app/questions/page.tsx`                    | Question bank list; replaces the stub                         | Created in Phase 4  |
| `src/app/questions/new/page.tsx`                | Create page                                                   | Created in Phase 4  |
| `src/app/questions/[id]/edit/page.tsx`          | Edit page; `notFound()` on a missing id                       | Created in Phase 4  |
| `src/components/mcq/McqTable.tsx`               | Client table with the three-dot Action menu                   | Created in Phase 4  |
| `src/components/mcq/PreviewMcqDialog.tsx`       | Author try-it preview; Correct/Incorrect after selection only | Created in Phase 4; behavior finalized Phase 5 |
| `src/components/mcq/DeleteMcqDialog.tsx`        | Delete confirmation                                           | Created in Phase 4  |
| `src/components/mcq/McqForm.tsx`                | Shared create/edit form with the choice editor                | Created in Phase 4  |
| `src/components/ui/radio-group.tsx`             | Correct-answer control (form) and selectable Preview choices  | Added in Phase 4 (user-approved) |

### Implementation Patterns

Writing an MCQ and its choices atomically. D1 wraps a `batch()` in a transaction, so a failure on choice four does not leave three choices behind:

```typescript
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
        input.description?.trim() || null,
        input.createdByUserId ?? null,
      ),
    ...input.choices.map((choice, index) =>
      db
        .prepare(
          `INSERT INTO mcq_choices (id, mcq_id, choice_text, is_correct, position)
           VALUES (?1, ?2, ?3, ?4, ?5)`,
        )
        .bind(newId(), id, choice.text.trim(), choice.isCorrect ? 1 : 0, index + 1),
    ),
  ];

  await db.batch(statements);

  const created = await getMcqById(id);
  if (!created) {
    throw new Error("MCQ was inserted but could not be read back");
  }
  return created;
}
```

`description?.trim() || null` is deliberate: an omitted description and one typed as spaces both become `NULL`, so the list page has one empty case to render rather than two.

Mapping a choice row, showing the integer-to-boolean conversion that keeps `1` out of the public type:

```typescript
function toChoice(row: McqChoiceRow): McqChoice {
  return {
    id: row.id,
    mcqId: row.mcq_id,
    text: row.choice_text,
    isCorrect: row.is_correct === 1,
    position: row.position,
  };
}
```

The choice-set rule, expressed once in Zod so neither the service nor the form re-implements it:

```typescript
const choicesSchema = z
  .array(z.object({ text: z.string().trim().min(1).max(500), isCorrect: z.boolean() }))
  .min(2, "A question needs at least 2 choices")
  .max(6, "A question can have at most 6 choices")
  .refine((choices) => choices.filter((choice) => choice.isCorrect).length === 1, {
    message: "Exactly one choice must be marked correct",
  });
```

A dynamic route handler, awaiting params as Next.js 16 requires:

```typescript
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
```

Its test supplies the same shape, resolved:

```typescript
const response = await DELETE(new Request("http://localhost/api/mcqs/abc", { method: "DELETE" }), {
  params: Promise.resolve({ id: "abc" }),
});
```

The list page reads through the service rather than calling its own API over HTTP:

```typescript
export default async function QuestionsPage() {
  try {
    const mcqs = await listMcqs();
    return <McqTable mcqs={mcqs} />;
  } catch (error) {
    console.error("failed to load questions", error);
    return <p className="text-sm text-destructive">Unable to load questions right now.</p>;
  }
}
```

### Important Notes

- **`db.batch()` must exist on the fake before the service uses it.** `createFakeD1` currently rejects `batch()` with "not implemented". Phase 1 adds it test-first. Skipping that leaves every Phase 2 service test failing for a reason that has nothing to do with the service.
- **Do not rely on `ON DELETE CASCADE` alone.** Foreign key enforcement is a per-connection pragma in SQLite, and behavior can differ between local Wrangler and deployed D1. `deleteMcq` deletes choices explicitly and treats the cascade as a backstop, not as the mechanism.
- **Editing an MCQ deletes and reinserts its choices.** Any attempt row pointing at a replaced choice gets `mcq_choice_id` set to `NULL`, which is why `selected_choice_text` and `is_correct` are snapshotted on the attempt. Nothing writes attempts this sprint, so no data is at risk yet — but the next sprint inherits this behavior and should know about it.
- **Dynamic route params are a Promise in Next.js 16.** Destructuring `{ params }` and reading `params.id` synchronously compiles under TypeScript's structural check in some configurations and then fails at runtime. Always `await params`.
- **On Windows, `npm run dev` does not load D1 bindings.** `/questions` will render its error state because `listMcqs()` throws. That is expected. Use `npm run preview`.
- **Prefer `?1`-style placeholders.** Mixing anonymous `?` with numbered placeholders triggers binding errors in local Wrangler.
- **Only `dropdown-menu` was approved.** Do not add `sonner`, `alert-dialog`, `textarea`, `radio-group`, or `react-hook-form`. Ask before adding any npm package.
- **Known limitation, stated plainly:** `created_by_user_id` will be `NULL` on every row this sprint, and every endpoint is unauthenticated, so any caller can edit or delete any question. This is the accepted cost of deferring sessions for a second sprint.

---

## Acceptance Criteria

- [x] `migrations/0002_create_mcq_tables.sql` exists and applies locally with `npx wrangler d1 migrations apply ai-sprint-quiz-db --local`
- [x] `npx wrangler d1 migrations list ai-sprint-quiz-db --local` shows it applied
- [x] Migrations were not applied with `--remote`
- [x] `mcqs`, `mcq_choices`, and `mcq_attempts` all exist with the columns and constraints in Database Schema
- [x] `mcq_attempts.mcq_choice_id` uses `ON DELETE SET NULL`, so editing a question cannot destroy attempt history
- [x] A teacher can create a question with a name, question text, optional description, and two choices, and it appears in the table
- [x] A question can be created with up to six choices, stored with positions 1 through 6 (observed under `npm run preview` PUT, 2026-09-03)
- [x] Submitting fewer than two choices, more than six, or any number of correct answers other than one is rejected with a 400 and a visible message (API 400 under preview; form message covered by Phase 4 tests)
- [x] `/questions` lists every question newest first, with Name, Description, and Actions
- [x] A null description renders as an em dash rather than an empty cell
- [x] The empty state appears when there are no questions
- [x] The Actions column is a three-vertical-ellipsis menu offering Preview, Edit, and Delete
- [x] Preview loads the question without revealing the answer key; after the author selects a choice it shows Correct or Incorrect only, and the selection is not saved
- [x] Edit opens `/questions/[id]/edit` pre-filled with the saved values and the correct choice selected
- [x] Save persists the edit and returns to `/questions`; Cancel returns without saving and sends no request
- [x] Editing down from six choices to two leaves no orphaned `mcq_choices` rows (D1 query after preview PUT/DELETE)
- [x] Delete asks for confirmation, names the question, and removes it plus its choices only after confirming
- [x] Cancelling the delete dialog sends no request
- [x] A failed delete keeps the dialog open and shows an error rather than closing as if it worked
- [x] `GET`, `PUT`, and `DELETE` on an unknown id each return 404 with `Question not found` (GET observed under preview)
- [x] No endpoint returns an internal error message to the client (preview run: no 500s; 400/404 use public messages)
- [x] All SQL against the three tables lives in `mcq-service.ts`
- [x] Each phase's Vitest tests were written first, observed failing, then made green before that phase was marked COMPLETED
- [x] `npm test` passes, including all 73 inherited tests
- [x] `npm run lint` passes
- [x] `npm run build` succeeds
- [x] The full create → list → edit → delete flow works under `npm run preview` on the Workers runtime (API + browser verified; user confirmed 2026-09-04)
- [x] Only approved shadcn components were added (`dropdown-menu`, plus `radio-group` for the form and Preview)

---

## Success Metrics

| Metric                                     | Target                                              | How Measured                                                              |
| ------------------------------------------ | ----------------------------------------------------- | --------------------------------------------------------------------------- |
| Questions authored in the first week       | At least 10                                         | Row count in `mcqs`                                                       |
| Teachers who have authored a question      | At least 2, enough to prove the bank is shared      | Distinct authors, once sessions populate `created_by_user_id`             |
| Create form completion rate                | > 85% of opened create pages result in a saved question | 201 responses against `/questions/new` page loads                     |
| Questions with an invalid choice set       | 0                                                   | Query for any `mcq_id` with fewer than 2, more than 6, or not exactly 1 correct choice |
| Orphaned choice rows                       | 0                                                   | `mcq_choices` rows whose `mcq_id` has no matching `mcqs` row              |
| Question list load time                    | p95 under 500ms                                     | Workers observability, already enabled in `wrangler.jsonc`                |
| Unhandled 500s on MCQ endpoints            | 0 during this sprint's manual testing               | Worker logs during Phase 5 preview                                        |
| Accidental deletions reported              | 0                                                   | The confirmation dialog exists precisely to keep this at zero              |

---

## Dependencies

### External Dependencies

- **Cloudflare D1** - Already provisioned as `ai-sprint-quiz-db` and bound as `DB`. This sprint adds tables to it; it does not create a database.

### npm Dependencies

**None.** Everything needed is installed: `zod` for validation, `vitest` and Testing Library for tests, `lucide-react` for the ellipsis icon.

One shadcn **component** was planned at kickoff:

```bash
npx shadcn@latest add @shadcn/dropdown-menu
```

A second was later approved for the correct-answer control and Preview selection:

```bash
npx shadcn@latest add @shadcn/radio-group
```

`AGENTS.md` still applies: ask before installing anything else. `sonner`, `alert-dialog`, `textarea`, and `react-hook-form` remain declined.

### Internal Dependencies

- `src/lib/db.ts` - Existing D1 accessor; consumed by the MCQ service. Do not create a second one.
- `src/test-support/fake-d1.ts` - Existing D1 fake, extended with `batch()` in Phase 1
- `src/lib/validation/http.ts` - Existing `toFieldErrors`; reused by the MCQ route handlers
- `src/lib/services/mcq-service.ts` - Consumed by the route handlers and by the `/questions` server components
- `src/components/ui/` - Existing `table`, `button`, `card`, `field`, `input`, `label`, `dialog`, plus `dropdown-menu` and `radio-group`
- `src/components/auth/LogoutButton.tsx` - Stays on the rebuilt `/questions` page
- `users` table - Referenced by `mcqs.created_by_user_id` and `mcq_attempts.user_id`, both nullable

### Environment Variables

None. No new binding and no new secret, so `.dev.vars` and `.dev.vars.example` need no changes.

---

## Risks and Mitigation

### Technical Risks

- **Risk**: `createFakeD1` rejects `batch()`, so every service test fails for a harness reason rather than a behavior reason, and the temptation is to abandon `batch()` and write statements sequentially.
- **Mitigation**: Phase 1 extends the fake before Phase 2 needs it, with its own tests. Sequential writes are not an acceptable fallback: a partial MCQ is a data integrity bug that no test would catch.

- **Risk**: Editing a question deletes and reinserts its choices. If `mcq_attempts.mcq_choice_id` were `ON DELETE CASCADE`, a routine typo fix would silently delete every attempt ever recorded against that question.
- **Mitigation**: `ON DELETE SET NULL` plus the `selected_choice_text` and `is_correct` snapshots on the attempt row. A Phase 1 migration test asserts the constraint specifically, because this failure is silent and would be found long after the data was gone.

- **Risk**: The 2-to-6 choice rule is enforced in three places — the browser form, the Zod schema, and the `CHECK` constraint — and the three drift apart.
- **Mitigation**: Zod is the single authority for the count and the one-correct rule. The form disables Add and Remove at the boundaries so it cannot produce an invalid payload, and the database `CHECK` only bounds `position`, which is a different guarantee. The service does not re-validate.

- **Risk**: Base UI's `DropdownMenu` and `Dialog` use portals and pointer-event guards that behave unevenly in jsdom, so component tests fail for reasons unrelated to the code under test.
- **Mitigation**: A Troubleshooting entry covers the known workarounds. If a menu genuinely cannot be driven in jsdom, test the handler wiring directly rather than deleting the assertion, and verify the interaction in Phase 5.

- **Risk**: `/questions` is a Server Component that hits D1 at render, so it breaks under `npm run dev` on Windows where bindings are unavailable.
- **Mitigation**: The page catches the error and renders a readable message instead of the Next.js overlay. Phase 5 verifies the real path under `npm run preview`.

- **Risk**: Reading dynamic route params synchronously works in development and fails elsewhere.
- **Mitigation**: Every handler and page awaits `params`, and route tests pass a real Promise so a synchronous read fails in Vitest first.

### Security Risks Accepted for This Sprint

Stated explicitly so no one later mistakes them for oversights:

- **Risk**: Every MCQ endpoint is unauthenticated. Anyone who can reach the app can create, edit, or delete any question in the shared bank.
- **Mitigation**: None available without sessions, which were considered for this sprint and declined. This is now the second sprint deferring it, and the risk grows with the amount of data in the bank. It should be the next thing built.

- **Risk**: `created_by_user_id` is `NULL` on every row, so there is no attribution and no way to reconstruct who wrote what after the fact.
- **Mitigation**: The column and the service parameter exist, so populating them is a small change once sessions land. Rows created this sprint will never be attributable retroactively — that history is simply lost, and it is worth knowing before the bank fills up.

### User Experience Risks

- **Risk**: Delete is irreversible and there are no soft deletes, so one wrong click on a three-dot menu destroys a question and its choices permanently.
- **Mitigation**: A confirmation dialog that names the question being deleted, and per-row menu triggers with distinct accessible names so the wrong row is harder to open in the first place.

- **Risk**: A teacher fills in a long question, gets a validation error on submit, and loses the work.
- **Mitigation**: The form keeps all state on a failed submit and renders errors inline. Nothing is cleared, and Cancel is the only path that discards.

- **Risk**: `name` and `question` are two text fields that sound like the same thing, and teachers put the whole question in `name`.
- **Mitigation**: Label them distinctly with helper text: Name is "a short label for the question bank", Question is "what the student reads".

- **Risk**: The list shows no indication of who wrote a question, which undercuts the collaboration story the accounts were built for.
- **Mitigation**: Accepted this sprint. An Author column is a natural addition the moment `created_by_user_id` is populated.

---

## Troubleshooting Guide

Populate this section during implementation as real problems surface. The entries below are the failures most likely to occur given this stack.

### `fake-d1: batch() is not implemented`

**Problem**: Every `mcq-service` test fails on the first write.
**Cause**: Phase 2 was started before Phase 1 extended the fake.
**Solution**: Implement `batch()` in the fake, test-first, before touching the service. **Code reference**: `src/test-support/fake-d1.ts`

### `no such table: mcqs`

**Problem**: Queries fail even though the migration file exists.
**Cause**: The migration was written but never applied to the local database.
**Solution**: `npx wrangler d1 migrations apply ai-sprint-quiz-db --local`. Do not pass `--remote`.

### `FOREIGN KEY constraint failed` when inserting a choice

**Problem**: The MCQ insert succeeds and the choice insert fails.
**Cause**: The choice was bound to an `mcq_id` that does not exist yet — usually because the statements ran out of order, or the MCQ insert was not in the same batch.
**Solution**: Put the MCQ insert first in the `batch()` array. D1 executes batched statements in order.

### `params.id` is undefined in a route handler

**Problem**: The handler receives the request but the id is missing.
**Cause**: `params` is a Promise in Next.js 16 and was read without awaiting.
**Solution**: `const { id } = await params;` in every dynamic handler and page.

### The dropdown menu does not open in a jsdom test

**Problem**: `userEvent.click` on the trigger fires, but Edit and Delete never appear.
**Cause**: Base UI menus check pointer events and render into a portal. jsdom reports computed styles differently, and the content is not inside the container Testing Library returned from `render`.
**Solution**: Use `userEvent.setup({ pointerEventsCheck: 0 })`, query with `screen` rather than the render result so the portal is searched, and `await` a `findBy*` query since the menu opens asynchronously.

### A choice edit wipes out attempts

**Problem**: Attempt rows disappear after a question is edited.
**Cause**: `mcq_attempts.mcq_choice_id` was declared `ON DELETE CASCADE` instead of `ON DELETE SET NULL`.
**Solution**: Fix the constraint in the migration and reapply locally. The Phase 1 migration test asserts this specifically. **Code reference**: `migrations/0002_create_mcq_tables.sql`

### `D1_ERROR: Wrong number of parameter bindings`

**Problem**: A query fails despite looking correct.
**Cause**: Anonymous `?` placeholders mixed with numbered ones, or a placeholder index that does not match the bind count. `updateMcq` builds its assignment list dynamically, which makes this easy to get wrong.
**Solution**: Use numbered placeholders throughout, and derive the index from the params array length as `updateUser` does. **Code reference**: `src/lib/services/user-service.ts` `updateUser`

### `wrangler d1 migrations list --local` prints "No migrations to apply"

**Problem**: Wrangler 4.118 does not print a table of applied migration names. After a successful apply it later reports `No migrations to apply!`.
**Cause**: The list command now means "nothing left to run", not "here is the applied set".
**Solution**: Confirm with `npx wrangler d1 execute ai-sprint-quiz-db --local --command "SELECT name FROM sqlite_master WHERE type='table'"` and look for `mcqs`, `mcq_choices`, and `mcq_attempts`. **Code reference**: `migrations/0002_create_mcq_tables.sql`

### Combined `npm test` times out starting a jsdom forks worker

**Problem**: `vitest run` (both projects together) can fail with `[vitest-pool-runner]: Timeout waiting for worker to respond` on `RegisterForm.test.tsx`, even though the suites are green in isolation.
**Cause**: Pre-existing: the jsdom project uses `pool: "forks"` and `maxWorkers: 1` because worker_threads hang on this Node 26 alpha. Starting both projects in one process still sometimes never gets the forks worker "started" handshake.
**Solution**: Re-run `npx vitest run --project node` and `npx vitest run --project jsdom` separately. Do not switch the node project off `pool: "threads"`. **Code reference**: `vitest.config.mts`

### `/questions` shows "Unable to load questions" in development

**Problem**: The page renders its error state with no obvious cause.
**Cause**: On Windows, `npm run dev` does not load D1 bindings, so `getDb()` throws.
**Solution**: Expected. Use `npm run preview`. **Code reference**: `src/lib/db.ts`, `next.config.ts`

---

## Notes for AI Agents

When working from this PRD:

1. Read Overview and Hypothesis first to understand intent.
2. Treat Scope as binding. Do not build anything under Out of Scope — in particular, **do not add sessions, cookies, or route protection**, and **do not build an attempts service, attempts endpoints, or a quiz-taking UI**. All of those were explicitly deferred by the user. Raise it with them instead of building it.
3. The D1 database, `src/lib/db.ts`, `src/test-support/fake-d1.ts`, `src/lib/validation/http.ts`, and the Vitest harness already exist from the identity sprint. Extend them; do not duplicate them.
4. Start every phase by writing the Vitest tests in that phase's TDD plan and running them — they must fail. Implement only enough to turn those tests green.
5. Do not start Phase 2 until Phase 1 tests are green and the migration is applied locally. Do not start Phase 3 until Phase 2 tests are green. Do not start Phase 4 until Phase 3 tests are green.
6. Update the phase status markers (`PLANNED` → `IN PROGRESS` → `COMPLETED`) as work progresses.
7. Add real code details under Technical Implementation Details as files are written, and correct anything in this document that implementation proves wrong. A PRD that disagrees with the code is worse than no PRD.
8. Check acceptance criteria off only after observing the behavior. Do not check anything off from code inspection alone.
9. Add a Troubleshooting entry every time a bug costs more than a few minutes, using the `filepath:line-number` reference format.
10. Ask before installing any npm package or generating any other shadcn component. Approved for this sprint: `dropdown-menu` and `radio-group`.
11. Never run `npm run deploy`, and never apply a migration with `--remote`.
12. Report actual command output when claiming a phase is done. `npm test`, `npm run lint`, and `npm run build` must be run, not assumed. The end-to-end flow must be verified under `npm run preview` after Phase 4.

---

## Current Status

**Last Updated**: 2026-09-04
**Current Phase**: Phase 5 - Workers Preview Verification
**Status**: COMPLETED
**Next Steps**: None for this sprint. Feature branch `feature/mcq-curd` carries schema through Workers-verified CRUD plus author Preview try-it.

**Phase 5 delivered:**

- `npm run preview` verified on Workers with local D1 (`http://127.0.0.1:8787`)
- Create → list → edit (including 6→2 choices) → delete observed; no 500s
- D1: `created_by_user_id` always `NULL`; `mcq_attempts` empty; no orphaned choices after delete
- User confirmed the browser UI flow (2026-09-04)
- Preview finalized: answer key hidden until selection; Correct/Incorrect feedback; selection not persisted (`PreviewMcqDialog` + tests)
- Acceptance Criteria fully checked from observed behavior

**Phase 4 delivered:**

- `McqTable` with Name / Description / Actions, empty state, and three-dot Preview/Edit/Delete menu
- `PreviewMcqDialog`, `DeleteMcqDialog`, shared `McqForm`
- `/questions`, `/questions/new`, `/questions/[id]/edit`
- Vitest: Phase 4 component tests green; node + jsdom suites green
- `npm run lint` exit 0 (warnings only); `npm run build` succeeded

**Phase 3 delivered:**

- `GET`/`POST` `/api/mcqs` and `GET`/`PUT`/`DELETE` `/api/mcqs/[id]`
- Zod validation via `createMcqSchema` / `updateMcqSchema`; `toFieldErrors` reused
- Dynamic route handlers await `params`; 404 for missing ids; 500 messages do not leak internals
- Vitest: 21 Phase 3 tests observed red (missing route modules), then green; full node suite green

**Phase 2 delivered:**

- `src/lib/validation/mcq-schemas.ts` with `createMcqSchema` / `updateMcqSchema` (2–6 choices, exactly one correct)
- `src/lib/services/mcq-service.ts` with `createMcq`, `getMcqById`, `listMcqs`, `updateMcq`, `deleteMcq`
- Creates and choice replacements use `db.batch()`; `is_correct` maps to a boolean; empty description stores `NULL`
- Vitest: Phase 2 tests observed red (missing modules), then green — 26 new tests; node + jsdom suites still green

**Phase 1 delivered:**

- `createFakeD1().db.batch()` records statements, returns one result per statement, consumes the queue in order, and rejects the whole batch on `queueError`
- `migrations/0002_create_mcq_tables.sql` creates `mcqs`, `mcq_choices`, and `mcq_attempts`
- Local apply succeeded; `sqlite_master` contains `users`, `mcqs`, `mcq_choices`, and `mcq_attempts`
- `src/components/ui/dropdown-menu.tsx` generated by shadcn; no new npm dependency
- Vitest: 13 Phase 1 tests observed red, then green. Node project 72 passed; jsdom project 14 passed (86 total, including the original 73)

**Still not doing from this close-out:** `npm run deploy`, or applying a migration with `--remote`.

**Open decisions carried into this sprint:**

- Sessions were considered and declined. `created_by_user_id` stays `NULL` and every endpoint stays unauthenticated. This is the second sprint deferring it.
- The attempts table ships without a service or endpoints, so nothing will write to it this sprint.
