# Take-Home Assignment: The Untested API — My Submission

> **Stack:** Node.js · Express · Jest · Supertest · Swagger UI
> **Coverage achieved:** 100% Statements · 100% Branches · 100% Functions · 100% Lines
> **Tests written:** 62 (all passing)

---

## Overview

I was handed a small Task Manager API that had **zero tests** and several real bugs heading to production. Over the course of this assignment I:

1. Read and understood the entire source codebase
2. Wrote a full unit + integration test suite from scratch
3. Found and documented **5 bugs** (3 confirmed, 2 potential)
4. Fixed **all 3 confirmed bugs** (the assignment only required fixing one)
5. Implemented the new `PATCH /tasks/:id/assign` feature with full validation and tests
6. Reached **100% code coverage** across all source files
7. Added **Swagger UI** — interactive API docs at `http://localhost:3000/api-docs`

---

## Getting Started

**Prerequisites:** Node.js 18+

```bash
cd task-api
npm install

npm test          # run all 62 tests
npm run coverage  # run tests + coverage report (100%)
npm start         # start server on http://localhost:3000
                  # Swagger UI → http://localhost:3000/api-docs
```

---

## Project Structure

```
Take-Home-Assignment-The-Untested-API-main/
├── ASSIGNMENT.md          # Original assignment brief
├── README.md              # This file — my submission summary
├── BUGS.md                # Bug report I wrote
├── SUBMISSION_NOTES.md    # Submission notes (next steps, surprises, questions)
└── task-api/
    ├── src/
    │   ├── app.js                  # Express app (Swagger UI + istanbul ignore)
    │   ├── swagger.js              # OpenAPI 3.0 spec
    │   ├── routes/tasks.js         # Routes (added PATCH /tasks/:id/assign)
    │   ├── services/taskService.js # Business logic (3 bugs fixed + assignTask added)
    │   └── utils/validators.js     # Validators (unchanged — already correct)
    ├── tests/
    │   ├── taskService.test.js     # Unit tests (37 tests)
    │   └── tasks.routes.test.js    # Integration tests (25 tests)
    └── demo.js                     # Live API demo script
```

---

## Part 1 — Read & Test

### What I did

- Read through all source files: `app.js`, `routes/tasks.js`, `services/taskService.js`, `utils/validators.js`
- Identified the data flow: routes → service → in-memory store
- Noticed suspicious patterns in the source code while reading (bugs found before tests even ran)
- Wrote a complete test suite covering every endpoint and every service function

### Test files written

#### `tests/taskService.test.js` — Unit tests (37 tests)

Covers every exported function in `taskService.js` directly:

| Function | Tests |
|---|---|
| `getAll` | empty store, returns all, copy safety |
| `create` | defaults, explicit fields, unique IDs |
| `findById` | found, not found |
| `getByStatus` | exact match, no match, partial string rejection |
| `getPaginated` | page 1, page 2, last page, out-of-bounds |
| `getStats` | zero counts, by status, overdue, done excluded, unknown status |
| `update` | updates fields, not found, preserves other fields |
| `remove` | removes, returns false if not found |
| `completeTask` | sets done + completedAt, preserves priority, not found |

#### `tests/tasks.routes.test.js` — Integration tests (25 tests)

Uses Supertest against the real Express app. Covers every HTTP endpoint:

| Endpoint | Tests |
|---|---|
| `GET /tasks` | empty, all tasks, `?status=` filter, pagination, out-of-bounds, non-numeric fallback |
| `GET /tasks/stats` | zero, by status, overdue |
| `POST /tasks` | 201 happy path, missing title, empty title, bad status, bad priority, bad dueDate |
| `PUT /tasks/:id` | 200 update, 404 not found, bad status, empty title, bad priority, bad dueDate |
| `DELETE /tasks/:id` | 204 delete, 404 not found, confirmed gone after delete |
| `PATCH /tasks/:id/complete` | marks done, sets completedAt, 404, preserves priority |
| `PATCH /tasks/:id/assign` | assigns, 404, missing assignee, empty string, non-string, reassign |
| Error middleware | 500 on unhandled throw |

### Coverage result

```
All files        | 100 | 100 | 100 | 100 |
  app.js         | 100 | 100 | 100 | 100 |
  tasks.js       | 100 | 100 | 100 | 100 |
  taskService.js | 100 | 100 | 100 | 100 |
  validators.js  | 100 | 100 | 100 | 100 |

Test Suites: 2 passed, 2 total
Tests:       62 passed, 62 total
```

---

## Part 2 — Find & Build

### Part A: Bug Report (`BUGS.md`)

I found **3 confirmed bugs** and **2 potential issues** by reading the code and running tests.

---

#### Bug 1 — `getPaginated`: Off-by-one in page offset ✅ Fixed

**File:** `src/services/taskService.js`

**Root cause:** The offset was calculated as `page * limit`, treating page numbers as 0-indexed. The API docs and callers treat `?page=1` as the first page, so the correct formula is `(page - 1) * limit`.

```js
// Before (bug)
const offset = page * limit;          // page=1, limit=2 → offset 2 ❌

// After (fix)
const offset = (page - 1) * limit;   // page=1, limit=2 → offset 0 ✅
```

**Impact:** `GET /tasks?page=1` would silently skip the first `limit` items. The very first page of results was always wrong.

---

#### Bug 2 — `getByStatus`: Substring match instead of strict equality ✅ Fixed

**File:** `src/services/taskService.js`

**Root cause:** Used `String.prototype.includes()` instead of `===`. This made `?status=in` return all `in_progress` tasks, and `?status=o` return all `todo` tasks — completely wrong.

```js
// Before (bug)
const getByStatus = (status) => tasks.filter((t) => t.status.includes(status));

// After (fix)
const getByStatus = (status) => tasks.filter((t) => t.status === status);
```

**Impact:** Status filtering was fundamentally broken for any partial string. Only exact status strings happened to work by coincidence.

---

#### Bug 3 — `completeTask`: Silently resets task priority ✅ Fixed

**File:** `src/services/taskService.js`

**Root cause:** A stray `priority: 'medium'` line inside `completeTask` overwrote the task's existing priority unconditionally. Every task, regardless of whether it was `high` or `low` priority, became `medium` the moment it was marked complete.

```js
// Before (bug)
const updated = {
  ...task,
  priority: 'medium',   // ← silently corrupts data ❌
  status: 'done',
  completedAt: new Date().toISOString(),
};

// After (fix)
const updated = {
  ...task,              // priority preserved from spread ✅
  status: 'done',
  completedAt: new Date().toISOString(),
};
```

**Impact:** Silent data corruption. Any client tracking task priority would see it change unexpectedly on completion — with no error and no indication anything changed.

---

#### Potential Issue 4 — Unknown `?status=` returns 200 instead of 400

`GET /tasks?status=blah` returns `200 []` — indistinguishable from "no matching tasks." A client with a typo in their status filter would never know. Documented but not fixed as it is outside the required bug-fix scope.

#### Potential Issue 5 — `PUT /tasks/:id` allows overwriting immutable fields

The `update()` function spreads the entire request body, so a client can overwrite `id`, `createdAt`, or `completedAt`. Documented but not fixed — would require an explicit allowlist.

---

### Part B: Fixed one bug (fixed all three)

The fix for Bug 3 (completeTask priority clobber) was the clearest case of harmful silent data corruption, so it was the primary fix. Bugs 1 and 2 were also small and isolated, so I fixed all three.

Tests were written to both **document the buggy behaviour** (with comments explaining what was wrong) and **assert the correct behaviour after the fix**.

---

### Part C: New Feature — `PATCH /tasks/:id/assign`

**Added in:** `src/routes/tasks.js` + `src/services/taskService.js`

```
PATCH /tasks/:id/assign
Body: { "assignee": "string" }
```

#### Behaviour

- Stores the `assignee` (trimmed) on the task object and returns the updated task
- Returns `404` if the task does not exist
- Returns `400` if `assignee` is missing, not a string, or is empty/whitespace-only
- Reassigning a task that already has an assignee is **allowed** — returns `200` with the new value

#### Design decisions

| Decision | Rationale |
|---|---|
| Reject empty/whitespace strings | An empty assignee provides no useful information — better to reject than store garbage |
| Trim the assignee value before storing | Prevents `"Alice"` and `"Alice "` from being treated as different assignees |
| Allow reassignment | No business rule was given to prevent it; blocking it silently would be worse |
| No user registry validation | The API has no concept of users — validating against an external list would add a dependency not present in the codebase |

#### Code added

**`src/services/taskService.js`**
```js
const assignTask = (id, assignee) => {
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return null;

  const updated = { ...tasks[index], assignee };
  tasks[index] = updated;
  return updated;
};
```

**`src/routes/tasks.js`**
```js
router.patch('/:id/assign', (req, res) => {
  const { assignee } = req.body;

  if (typeof assignee !== 'string' || assignee.trim() === '') {
    return res.status(400).json({ error: 'assignee must be a non-empty string' });
  }

  const task = taskService.assignTask(req.params.id, assignee.trim());
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  res.json(task);
});
```

#### Tests written for the new endpoint (6 tests)

- Assigns successfully → 200 + updated task
- Task not found → 404
- Missing `assignee` → 400
- Empty/whitespace `assignee` → 400
- Non-string `assignee` (e.g. number) → 400
- Reassigning an already-assigned task → 200 with new value

---

## Bonus — Swagger UI (Interactive API Docs)

Added `swagger-ui-express` + `swagger-jsdoc` to provide a live, interactive API explorer directly in the browser.

**URL:** `http://localhost:3000/api-docs` (start the server first with `npm start`)

### What it includes

- Full **OpenAPI 3.0** specification in `src/swagger.js`
- Every endpoint documented with summary, description, request body schema, and all response codes
- Typed schemas for `Task`, `Stats`, and `Error` response objects
- **"Try it out"** button on every endpoint — send real HTTP requests from the browser
- Custom dark navy top-bar styling

### All 7 endpoints visible in the UI

| Method | Path | Description |
|---|---|---|
| `GET` | `/tasks` | List all tasks (with `?status`, `?page`, `?limit` params) |
| `POST` | `/tasks` | Create a new task |
| `GET` | `/tasks/stats` | Counts by status + overdue count |
| `PUT` | `/tasks/{id}` | Update a task |
| `DELETE` | `/tasks/{id}` | Delete a task |
| `PATCH` | `/tasks/{id}/complete` | Mark a task as complete |
| `PATCH` | `/tasks/{id}/assign` | Assign a task to a user |

---

## Files I Created or Modified

| File | Action | Purpose |
|---|---|---|
| `task-api/tests/taskService.test.js` | **Created** | Unit tests for all service functions |
| `task-api/tests/tasks.routes.test.js` | **Created** | Integration tests for all API routes |
| `task-api/src/services/taskService.js` | **Modified** | Fixed 3 bugs, added `assignTask` function |
| `task-api/src/routes/tasks.js` | **Modified** | Added `PATCH /tasks/:id/assign` route |
| `task-api/src/app.js` | **Modified** | Swagger UI mount + `/* istanbul ignore next */` |
| `task-api/src/swagger.js` | **Created** | Full OpenAPI 3.0 spec for all 7 endpoints |
| `task-api/demo.js` | **Created** | Node.js script to demo all endpoints live |
| `BUGS.md` | **Created** | Full bug report with root causes |
| `SUBMISSION_NOTES.md` | **Created** | Submission notes: next steps, surprises, prod questions |
