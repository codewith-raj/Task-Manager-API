# Bug Report — Task Manager API

---

## Bug 1 — `getPaginated`: Off-by-one in page offset *(FIXED)*

**File:** `src/services/taskService.js`, line 12

**Expected behaviour:** `GET /tasks?page=1&limit=2` returns the **first two tasks** in the store.

**Actual behaviour:** Returns an empty array (for small stores) or the wrong slice. With 5 tasks and `page=1, limit=2`, the offset is calculated as `1 * 2 = 2`, so the result begins at index 2 — skipping the first two tasks entirely and behaving as if page numbers were 0-indexed.

**How discovered:** Integration test asserting that `page=1` returns the first task's title.

**Root cause:**
```js
// Before (bug)
const offset = page * limit;          // page=1,limit=2  → offset 2  ❌
// After (fix)
const offset = (page - 1) * limit;   // page=1,limit=2  → offset 0  ✅
```

**Fix applied:** Changed the offset formula to `(page - 1) * limit` in `taskService.js`.

---

## Bug 2 — `getByStatus`: Substring match instead of strict equality

**File:** `src/services/taskService.js`, line 9

**Expected behaviour:** `GET /tasks?status=in` returns 0 tasks (no status is literally `"in"`).

**Actual behaviour:** Returns every task with status `"in_progress"` because `"in_progress".includes("in")` is `true`. This also means searching for `"o"` would return `"todo"` tasks.

**How discovered:** Unit test filtering for the status string `"in"` and expecting 0 results.

**Root cause:**
```js
// Before (bug)
const getByStatus = (status) => tasks.filter((t) => t.status.includes(status));
// After (fix)
const getByStatus = (status) => tasks.filter((t) => t.status === status);
```

**Fix applied:** Changed `.includes()` to strict `===` equality in `taskService.js`.

---

## Bug 3 — `completeTask`: Silently clobbers task priority *(FIXED)*

**File:** `src/services/taskService.js`, line 69

**Expected behaviour:** Marking a task complete changes `status → 'done'` and sets `completedAt`. The task's `priority` is **preserved**.

**Actual behaviour:** Every task — regardless of its original priority — has its priority reset to `'medium'` on completion. A `high`-priority urgent task becomes `medium` silently, which corrupts existing data.

**How discovered:** Integration test creating a task with `priority: 'high'`, completing it, then asserting `res.body.priority === 'high'`.

**Root cause:**
```js
// Before (bug)
const updated = {
  ...task,
  priority: 'medium',   // ← overwrites whatever was there ❌
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

**Fix applied:** Removed the `priority: 'medium'` line in `taskService.js`.

---

## Potential Issue 4 — `getByStatus`: No validation for unknown statuses (not a crash, but bad UX)

**File:** `src/routes/tasks.js`, line 14–17

**Expected behaviour:** `GET /tasks?status=blah` returns 400 with a helpful error.

**Actual behaviour:** Returns 200 with an empty array — indistinguishable from "no tasks match."

**No fix applied** — this would require adding a validation step in the route handler. It could confuse API consumers into thinking the filter worked but had no results.

---

## Potential Issue 5 — `PUT /tasks/:id` allows overwriting `id`, `createdAt`, `completedAt`

**File:** `src/services/taskService.js` → `update()`

**Root cause:** The update function does `{ ...tasks[index], ...fields }` with no field allowlist, so a client could `PUT` with `{ "id": "something-else" }` and corrupt the record's identity.

**No fix applied** — would require an explicit allowlist of updatable fields.
