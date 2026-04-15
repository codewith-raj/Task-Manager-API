/**
 * demo.js — runs through every endpoint live and prints the results
 */

const http = require('http');

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'localhost',
      port: 3000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };

    const r = http.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => (raw += chunk));
      res.on('end', () => {
        resolve({ status: res.statusCode, body: raw ? JSON.parse(raw) : null });
      });
    });

    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

const c = {
  cyan:   '\x1b[36m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
};

function header(label, color = c.cyan) {
  const line = '─'.repeat(60);
  console.log(`\n${color}${c.bold}${line}`);
  console.log(` ${label}`);
  console.log(`${line}${c.reset}`);
}

function print(res) {
  const statusColor = res.status < 300 ? c.green : res.status < 500 ? c.yellow : c.red;
  console.log(`${statusColor}HTTP ${res.status}${c.reset}`);
  console.log(JSON.stringify(res.body, null, 2));
}

(async () => {
  console.log(`\n${c.bold}${c.cyan}Task Manager API — Live Demo${c.reset}`);
  console.log('Server: http://localhost:3000\n');

  // ── CREATE ──────────────────────────────────────────────────────────────────
  header('POST /tasks  →  Create Task 1  (high priority, future due date)');
  const t1 = await req('POST', '/tasks', {
    title: 'Write unit tests',
    priority: 'high',
    dueDate: '2026-04-20T00:00:00.000Z',
  });
  print(t1);

  header('POST /tasks  →  Create Task 2  (in_progress)');
  const t2 = await req('POST', '/tasks', {
    title: 'Deploy to production',
    priority: 'medium',
    status: 'in_progress',
  });
  print(t2);

  header('POST /tasks  →  Create Task 3  (overdue — due in 2020)');
  const t3 = await req('POST', '/tasks', {
    title: 'Fix critical bug',
    priority: 'high',
    dueDate: '2020-01-01T00:00:00.000Z',
  });
  print(t3);

  // ── LIST ────────────────────────────────────────────────────────────────────
  header('GET /tasks  →  List all tasks');
  print(await req('GET', '/tasks'));

  header('GET /tasks?status=todo  →  Filter by status');
  print(await req('GET', '/tasks?status=todo'));

  header('GET /tasks?page=1&limit=2  →  Paginated (page 1, 2 per page)');
  print(await req('GET', '/tasks?page=1&limit=2'));

  // ── STATS ───────────────────────────────────────────────────────────────────
  header('GET /tasks/stats  →  Counts by status + overdue');
  print(await req('GET', '/tasks/stats'));

  // ── COMPLETE ────────────────────────────────────────────────────────────────
  header(`PATCH /tasks/${t1.body.id}/complete  →  Mark Task 1 as done`, c.green);
  print(await req('PATCH', `/tasks/${t1.body.id}/complete`));

  // ── ASSIGN ──────────────────────────────────────────────────────────────────
  header(`PATCH /tasks/${t2.body.id}/assign  →  Assign Task 2 to Alice`, c.green);
  print(await req('PATCH', `/tasks/${t2.body.id}/assign`, { assignee: 'Alice' }));

  // ── UPDATE ──────────────────────────────────────────────────────────────────
  header(`PUT /tasks/${t3.body.id}  →  Update Task 3 title + priority`, c.green);
  print(await req('PUT', `/tasks/${t3.body.id}`, {
    title: 'Fix critical bug — RESOLVED',
    priority: 'low',
  }));

  // ── STATS AFTER CHANGES ─────────────────────────────────────────────────────
  header('GET /tasks/stats  →  After completing Task 1 (overdue count drops)');
  print(await req('GET', '/tasks/stats'));

  // ── DELETE ──────────────────────────────────────────────────────────────────
  header(`DELETE /tasks/${t3.body.id}  →  Delete Task 3`, c.green);
  print(await req('DELETE', `/tasks/${t3.body.id}`));

  // ── FINAL LIST ──────────────────────────────────────────────────────────────
  header('GET /tasks  →  Final list (Task 3 gone)');
  print(await req('GET', '/tasks'));

  // ── VALIDATION ERRORS ───────────────────────────────────────────────────────
  console.log(`\n${c.yellow}${c.bold}${'━'.repeat(60)}`);
  console.log(' VALIDATION & ERROR CASES');
  console.log(`${'━'.repeat(60)}${c.reset}`);

  header('POST /tasks  →  400 — missing title', c.yellow);
  print(await req('POST', '/tasks', { priority: 'high' }));

  header('POST /tasks  →  400 — invalid priority', c.yellow);
  print(await req('POST', '/tasks', { title: 'Test', priority: 'critical' }));

  header('PATCH /tasks/nonexistent-id/complete  →  404 — task not found', c.yellow);
  print(await req('PATCH', '/tasks/nonexistent-id/complete'));

  header(`PATCH /tasks/${t2.body.id}/assign  →  400 — empty assignee`, c.yellow);
  print(await req('PATCH', `/tasks/${t2.body.id}/assign`, { assignee: '   ' }));

  header(`PATCH /tasks/${t2.body.id}/assign  →  400 — non-string assignee`, c.yellow);
  print(await req('PATCH', `/tasks/${t2.body.id}/assign`, { assignee: 42 }));

  header('DELETE /tasks/nonexistent-id  →  404 — task not found', c.yellow);
  print(await req('DELETE', '/tasks/nonexistent-id'));

  console.log(`\n${c.green}${c.bold}All endpoints demonstrated successfully!${c.reset}\n`);
})();
