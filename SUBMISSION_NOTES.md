# Submission Notes

## What I'd test next (given more time)

- **`PUT /tasks/:id` field allowlisting** — currently a client can overwrite `id`, `createdAt`, and `completedAt` since `update()` spreads the entire request body onto the task. I'd write a test that sends `{ id: "injected" }` and assert that the stored id is unchanged.
- **Concurrent mutations** — the in-memory store is a plain array. A rapid sequence of create/delete operations in the same tick could in theory produce race conditions. Worth testing if this API were to go async (e.g. backed by a DB).
- **Query-string edge cases for pagination** — what happens with `?page=0`, `?page=-1`, `?limit=0`, or `?limit=9999`? The parser currently does `parseInt(page) || 1` which silently coerces negatives and zero to 1, but `limit=9999` would return the full store. Worth capping with a `MAX_LIMIT` constant.
- **Status filter returning 200 for unknown statuses** — sending `?status=blah` returns `[]` instead of `400`. A consumer can't tell if there are no matching tasks or if the status name was a typo.
- **`PATCH /tasks/:id/assign` — concurrent reassign** — if two requests try to reassign the same task simultaneously, the last write wins with no conflict signal. Fine for this scope, worth documenting.

---

## Surprises in the codebase

1. **`completeTask` silently resets priority** — the `priority: 'medium'` line inside `completeTask` looked like a mistake from the start; there's no business rule that would require it, and it's not mentioned in the API docs. It quietly corrupts data that clients set intentionally.

2. **`getByStatus` uses `.includes()`** — using JavaScript's `String.prototype.includes` on the `status` field means the filter is effectively a substring search, not an equality check. Searching for `"in"` would return `in_progress` tasks, and searching for `"o"` would return `todo` tasks. Subtle and easy to miss without tests.

3. **Pagination is 0-indexed in the service but 1-indexed in the docs** — the README and ASSIGNMENT both describe `?page=1` as the first page, but the implementation uses `page * limit` as the offset, making page 1 skip the first `limit` items. This is the kind of off-by-one that only surfaces in production when users complain the first item is never visible.

---

## Questions I'd ask before shipping to production

1. **Auth** — there's no authentication or authorisation. Who can create, update, or delete tasks? Should users only see their own tasks?
2. **Persistence** — the in-memory store resets on every restart. Is there a planned database migration? What's the data-loss tolerance?
3. **`PUT` semantics** — is `PUT /tasks/:id` intended as a full replacement (requiring all fields) or a partial update? Currently it behaves as a partial update (merge), which is technically `PATCH` semantics.
4. **Assignee lifecycle** — can you unassign a task (set `assignee` back to null)? What happens if the assigned user is deleted from the system?
5. **Max page limit** — should `?limit` be capped server-side to prevent a client from requesting the entire dataset in one call?
