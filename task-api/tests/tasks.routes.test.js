'use strict';

const request = require('supertest');
const app = require('../src/app');
const taskService = require('../src/services/taskService');

beforeEach(() => {
  taskService._reset();
});

// ─── GET /tasks ───────────────────────────────────────────────────────────────

describe('GET /tasks', () => {
  it('returns 200 and empty array when no tasks exist', async () => {
    const res = await request(app).get('/tasks');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns all tasks', async () => {
    await request(app).post('/tasks').send({ title: 'A' });
    await request(app).post('/tasks').send({ title: 'B' });
    const res = await request(app).get('/tasks');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it('filters by ?status=todo', async () => {
    await request(app).post('/tasks').send({ title: 'Todo task', status: 'todo' });
    await request(app).post('/tasks').send({ title: 'In progress', status: 'in_progress' });
    const res = await request(app).get('/tasks?status=todo');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('Todo task');
  });

  it('paginates correctly with ?page=1&limit=2', async () => {
    for (let i = 1; i <= 5; i++) {
      await request(app).post('/tasks').send({ title: `Task ${i}` });
    }
    const res = await request(app).get('/tasks?page=1&limit=2');
    expect(res.status).toBe(200);
    // After the bug fix, page 1 should return the first 2 tasks
    expect(res.body).toHaveLength(2);
    expect(res.body[0].title).toBe('Task 1');
  });

  it('returns empty array for an out-of-bounds page', async () => {
    await request(app).post('/tasks').send({ title: 'Only task' });
    const res = await request(app).get('/tasks?page=99&limit=10');
    expect(res.body).toHaveLength(0);
  });

  it('falls back to page=1 and limit=10 for non-numeric pagination params', async () => {
    // parseInt('abc') → NaN → falsy → triggers the `|| 1` / `|| 10` branches
    for (let i = 1; i <= 5; i++) {
      await request(app).post('/tasks').send({ title: `Task ${i}` });
    }
    const res = await request(app).get('/tasks?page=abc&limit=xyz');
    expect(res.status).toBe(200);
    // page=1 (fallback), limit=10 (fallback) → all 5 tasks
    expect(res.body).toHaveLength(5);
  });
});

// ─── GET /tasks/stats ─────────────────────────────────────────────────────────

describe('GET /tasks/stats', () => {
  it('returns zero counts initially', async () => {
    const res = await request(app).get('/tasks/stats');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ todo: 0, in_progress: 0, done: 0, overdue: 0 });
  });

  it('counts tasks correctly after creation', async () => {
    await request(app).post('/tasks').send({ title: 'A', status: 'todo' });
    await request(app).post('/tasks').send({ title: 'B', status: 'in_progress' });
    const res = await request(app).get('/tasks/stats');
    expect(res.body.todo).toBe(1);
    expect(res.body.in_progress).toBe(1);
  });

  it('counts overdue tasks', async () => {
    await request(app)
      .post('/tasks')
      .send({ title: 'Overdue', status: 'todo', dueDate: '2000-01-01T00:00:00.000Z' });
    const res = await request(app).get('/tasks/stats');
    expect(res.body.overdue).toBe(1);
  });
});

// ─── POST /tasks ──────────────────────────────────────────────────────────────

describe('POST /tasks', () => {
  it('creates a task and returns 201 with the task body', async () => {
    const res = await request(app)
      .post('/tasks')
      .send({ title: 'Write tests', priority: 'high' });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Write tests');
    expect(res.body.priority).toBe('high');
    expect(res.body.id).toBeDefined();
  });

  it('returns 400 when title is missing', async () => {
    const res = await request(app).post('/tasks').send({ priority: 'low' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/title/i);
  });

  it('returns 400 when title is empty string', async () => {
    const res = await request(app).post('/tasks').send({ title: '   ' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid status', async () => {
    const res = await request(app).post('/tasks').send({ title: 'X', status: 'unknown' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid priority', async () => {
    const res = await request(app).post('/tasks').send({ title: 'X', priority: 'critical' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid dueDate', async () => {
    const res = await request(app).post('/tasks').send({ title: 'X', dueDate: 'not-a-date' });
    expect(res.status).toBe(400);
  });
});

// ─── PUT /tasks/:id ───────────────────────────────────────────────────────────

describe('PUT /tasks/:id', () => {
  it('updates a task and returns 200', async () => {
    const created = await request(app).post('/tasks').send({ title: 'Old' });
    const id = created.body.id;
    const res = await request(app).put(`/tasks/${id}`).send({ title: 'New', priority: 'high' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('New');
    expect(res.body.priority).toBe('high');
  });

  it('returns 404 for a non-existent task', async () => {
    const res = await request(app).put('/tasks/bad-id').send({ title: 'X' });
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid status in update', async () => {
    const created = await request(app).post('/tasks').send({ title: 'T' });
    const res = await request(app)
      .put(`/tasks/${created.body.id}`)
      .send({ status: 'invalid' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for empty title in update (validators.js line 22)', async () => {
    const created = await request(app).post('/tasks').send({ title: 'T' });
    const res = await request(app)
      .put(`/tasks/${created.body.id}`)
      .send({ title: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/title/i);
  });

  it('returns 400 for invalid priority in update (validators.js line 28)', async () => {
    const created = await request(app).post('/tasks').send({ title: 'T' });
    const res = await request(app)
      .put(`/tasks/${created.body.id}`)
      .send({ priority: 'critical' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/priority/i);
  });

  it('returns 400 for invalid dueDate in update (validators.js line 31)', async () => {
    const created = await request(app).post('/tasks').send({ title: 'T' });
    const res = await request(app)
      .put(`/tasks/${created.body.id}`)
      .send({ dueDate: 'not-a-date' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/dueDate/i);
  });
});

// ─── DELETE /tasks/:id ────────────────────────────────────────────────────────

describe('DELETE /tasks/:id', () => {
  it('deletes a task and returns 204', async () => {
    const created = await request(app).post('/tasks').send({ title: 'Delete me' });
    const res = await request(app).delete(`/tasks/${created.body.id}`);
    expect(res.status).toBe(204);
  });

  it('returns 404 for a non-existent task', async () => {
    const res = await request(app).delete('/tasks/no-such-id');
    expect(res.status).toBe(404);
  });

  it('task is no longer returned after deletion', async () => {
    const created = await request(app).post('/tasks').send({ title: 'Gone' });
    await request(app).delete(`/tasks/${created.body.id}`);
    const all = await request(app).get('/tasks');
    expect(all.body.find((t) => t.id === created.body.id)).toBeUndefined();
  });
});

// ─── PATCH /tasks/:id/complete ────────────────────────────────────────────────

describe('PATCH /tasks/:id/complete', () => {
  it('marks a task as done and sets completedAt', async () => {
    const created = await request(app).post('/tasks').send({ title: 'Finish' });
    const res = await request(app).patch(`/tasks/${created.body.id}/complete`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('done');
    expect(res.body.completedAt).not.toBeNull();
  });

  it('returns 404 for a non-existent task', async () => {
    const res = await request(app).patch('/tasks/bad-id/complete');
    expect(res.status).toBe(404);
  });

  // BUG: completeTask silently resets priority to 'medium'
  it('should preserve the task priority when completing', async () => {
    const created = await request(app).post('/tasks').send({ title: 'HP Task', priority: 'high' });
    const res = await request(app).patch(`/tasks/${created.body.id}/complete`);
    expect(res.body.priority).toBe('high');
  });
});

// ─── PATCH /tasks/:id/assign ──────────────────────────────────────────────────

describe('PATCH /tasks/:id/assign', () => {
  it('assigns a user to an existing task and returns 200', async () => {
    const created = await request(app).post('/tasks').send({ title: 'Assign me' });
    const res = await request(app)
      .patch(`/tasks/${created.body.id}/assign`)
      .send({ assignee: 'Alice' });
    expect(res.status).toBe(200);
    expect(res.body.assignee).toBe('Alice');
  });

  it('returns 404 when task does not exist', async () => {
    const res = await request(app)
      .patch('/tasks/no-such-id/assign')
      .send({ assignee: 'Bob' });
    expect(res.status).toBe(404);
  });

  it('returns 400 when assignee is missing', async () => {
    const created = await request(app).post('/tasks').send({ title: 'T' });
    const res = await request(app)
      .patch(`/tasks/${created.body.id}/assign`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/assignee/i);
  });

  it('returns 400 when assignee is an empty string', async () => {
    const created = await request(app).post('/tasks').send({ title: 'T' });
    const res = await request(app)
      .patch(`/tasks/${created.body.id}/assign`)
      .send({ assignee: '   ' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when assignee is not a string', async () => {
    const created = await request(app).post('/tasks').send({ title: 'T' });
    const res = await request(app)
      .patch(`/tasks/${created.body.id}/assign`)
      .send({ assignee: 42 });
    expect(res.status).toBe(400);
  });

  it('allows reassigning a task that already has an assignee', async () => {
    const created = await request(app).post('/tasks').send({ title: 'T' });
    await request(app)
      .patch(`/tasks/${created.body.id}/assign`)
      .send({ assignee: 'Alice' });
    const res = await request(app)
      .patch(`/tasks/${created.body.id}/assign`)
      .send({ assignee: 'Bob' });
    expect(res.status).toBe(200);
    expect(res.body.assignee).toBe('Bob');
  });
});

// ─── Error handler middleware ─────────────────────────────────────────────────

describe('Error handler middleware', () => {
  it('returns 500 when a route throws an unhandled error (app.js lines 10-11)', async () => {
    // Make getAll throw synchronously; Express 4 catches sync throws and
    // forwards them to the error handler via next(err).
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const serviceSpy = jest
      .spyOn(taskService, 'getAll')
      .mockImplementation(() => { throw new Error('Simulated crash'); });

    const res = await request(app).get('/tasks');

    serviceSpy.mockRestore();
    consoleSpy.mockRestore();

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
  });
});
