# Task Manager API — Take-Home Submission

**Stack:** Node.js, Express, Jest, Supertest, Swagger UI  
**Test status:** 62 tests passing  
**Coverage (Jest):** 100% statements · 98.82% branches · 100% functions · 100% lines

## Live demo (Render)

- **Swagger UI**: [`/api-docs`](https://task-manager-api-6omj.onrender.com/api-docs)
- **Tasks (JSON)**: [`/tasks`](https://task-manager-api-6omj.onrender.com/tasks)
- **Stats (JSON)**: [`/tasks/stats`](https://task-manager-api-6omj.onrender.com/tasks/stats)

Note: Render free tier may sleep after inactivity; the first request after sleep can take ~30s.

## Local setup

**Prerequisites:** Node.js 18+

```bash
cd task-api
npm install
npm test
npm run coverage
npm start
```

- **Local Swagger UI**: [`http://localhost:3000/api-docs`](http://localhost:3000/api-docs)

## What was delivered

- **Test suite**:
  - **Unit tests** for `src/services/taskService.js`: `task-api/tests/taskService.test.js`
  - **Integration tests** (Supertest) for routes: `task-api/tests/tasks.routes.test.js`
- **Bug report**: `BUGS.md`
- **Bug fixes** (three confirmed issues fixed):
  - Pagination offset (1-indexed page handling)
  - Status filtering (strict match vs substring match)
  - Completing a task no longer overwrites priority
- **New feature**: `PATCH /tasks/:id/assign` with validation + tests
- **API documentation**: Swagger UI at `/api-docs` (OpenAPI spec in `task-api/src/swagger.js`)
- **Submission notes**: `SUBMISSION_NOTES.md`

## New endpoint: assign a task

`PATCH /tasks/:id/assign`  
Body: `{ "assignee": "string" }`

Behavior:
- Returns **200** with the updated task on success
- Returns **404** if the task does not exist
- Returns **400** if `assignee` is missing, not a string, or empty/whitespace
- Reassignment is allowed (updates the stored assignee)

## Deploying to Render

1. Push the repository to GitHub.
2. In Render, create a **Web Service** connected to the repo.
3. Use these settings:

| Setting | Value |
|---|---|
| Root Directory | `task-api` |
| Runtime | Node |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Plan | Free |

Render will set `PORT` and `RENDER_EXTERNAL_URL` automatically.
