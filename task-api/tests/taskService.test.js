'use strict';

const taskService = require('../src/services/taskService');

beforeEach(() => {
  taskService._reset();
});

// ─── getAll ──────────────────────────────────────────────────────────────────

describe('getAll', () => {
  it('returns an empty array when no tasks exist', () => {
    expect(taskService.getAll()).toEqual([]);
  });

  it('returns all created tasks', () => {
    taskService.create({ title: 'Task A' });
    taskService.create({ title: 'Task B' });
    expect(taskService.getAll()).toHaveLength(2);
  });

  it('returns a copy — mutations do not affect the internal store', () => {
    taskService.create({ title: 'Task A' });
    const tasks = taskService.getAll();
    tasks.push({ id: 'fake' });
    expect(taskService.getAll()).toHaveLength(1);
  });
});

// ─── create ──────────────────────────────────────────────────────────────────

describe('create', () => {
  it('creates a task with required fields and sensible defaults', () => {
    const task = taskService.create({ title: 'Write tests' });
    expect(task.title).toBe('Write tests');
    expect(task.status).toBe('todo');
    expect(task.priority).toBe('medium');
    expect(task.description).toBe('');
    expect(task.dueDate).toBeNull();
    expect(task.completedAt).toBeNull();
    expect(task.id).toBeDefined();
    expect(task.createdAt).toBeDefined();
  });

  it('respects explicitly provided fields', () => {
    const due = '2030-01-01T00:00:00.000Z';
    const task = taskService.create({
      title: 'Deploy',
      description: 'Push to prod',
      status: 'in_progress',
      priority: 'high',
      dueDate: due,
    });
    expect(task.description).toBe('Push to prod');
    expect(task.status).toBe('in_progress');
    expect(task.priority).toBe('high');
    expect(task.dueDate).toBe(due);
  });

  it('assigns a unique id to every task', () => {
    const a = taskService.create({ title: 'A' });
    const b = taskService.create({ title: 'B' });
    expect(a.id).not.toBe(b.id);
  });
});

// ─── findById ────────────────────────────────────────────────────────────────

describe('findById', () => {
  it('finds an existing task by id', () => {
    const task = taskService.create({ title: 'Find me' });
    expect(taskService.findById(task.id)).toMatchObject({ title: 'Find me' });
  });

  it('returns undefined for a non-existent id', () => {
    expect(taskService.findById('non-existent-id')).toBeUndefined();
  });
});

// ─── getByStatus ─────────────────────────────────────────────────────────────

describe('getByStatus', () => {
  it('returns only tasks matching the given status', () => {
    taskService.create({ title: 'A', status: 'todo' });
    taskService.create({ title: 'B', status: 'in_progress' });
    taskService.create({ title: 'C', status: 'done' });

    const todos = taskService.getByStatus('todo');
    expect(todos).toHaveLength(1);
    expect(todos[0].title).toBe('A');
  });

  it('returns empty array when no tasks match', () => {
    taskService.create({ title: 'A', status: 'todo' });
    expect(taskService.getByStatus('done')).toHaveLength(0);
  });

  // BUG: getByStatus uses String.includes() instead of strict equality,
  // meaning a search for 'in' would match 'in_progress'. This test
  // documents the correct expected behaviour (exact match).
  it('does NOT match partial status strings', () => {
    taskService.create({ title: 'A', status: 'in_progress' });
    // Searching 'in' should return 0 results — not the in_progress task
    const results = taskService.getByStatus('in');
    expect(results).toHaveLength(0);
  });
});

// ─── getPaginated ────────────────────────────────────────────────────────────

describe('getPaginated', () => {
  beforeEach(() => {
    for (let i = 1; i <= 5; i++) {
      taskService.create({ title: `Task ${i}` });
    }
  });

  // BUG: getPaginated uses (page * limit) as the offset instead of
  // (page - 1) * limit, which means page=1 returns tasks 2-4 (offset 10)
  // instead of tasks 1-2 (offset 0). This test documents correct behaviour.
  it('returns the first page correctly (page 1)', () => {
    const page1 = taskService.getPaginated(1, 2);
    expect(page1).toHaveLength(2);
    // Page 1 should return the first two tasks
    expect(page1[0].title).toBe('Task 1');
    expect(page1[1].title).toBe('Task 2');
  });

  it('returns the second page correctly (page 2)', () => {
    const page2 = taskService.getPaginated(2, 2);
    expect(page2).toHaveLength(2);
    expect(page2[0].title).toBe('Task 3');
    expect(page2[1].title).toBe('Task 4');
  });

  it('returns remaining items on the last page', () => {
    const page3 = taskService.getPaginated(3, 2);
    expect(page3).toHaveLength(1);
    expect(page3[0].title).toBe('Task 5');
  });

  it('returns empty array for out-of-bounds page', () => {
    expect(taskService.getPaginated(10, 2)).toHaveLength(0);
  });
});

// ─── getStats ────────────────────────────────────────────────────────────────

describe('getStats', () => {
  it('returns zero counts when no tasks exist', () => {
    expect(taskService.getStats()).toEqual({ todo: 0, in_progress: 0, done: 0, overdue: 0 });
  });

  it('counts tasks by status', () => {
    taskService.create({ title: 'A', status: 'todo' });
    taskService.create({ title: 'B', status: 'in_progress' });
    taskService.create({ title: 'C', status: 'done' });
    const stats = taskService.getStats();
    expect(stats.todo).toBe(1);
    expect(stats.in_progress).toBe(1);
    expect(stats.done).toBe(1);
  });

  it('counts overdue tasks (non-done with past dueDate)', () => {
    taskService.create({ title: 'Overdue', status: 'todo', dueDate: '2000-01-01T00:00:00.000Z' });
    taskService.create({ title: 'Not due', status: 'todo', dueDate: '2099-01-01T00:00:00.000Z' });
    taskService.create({ title: 'Done overdue', status: 'done', dueDate: '2000-01-01T00:00:00.000Z' });

    expect(taskService.getStats().overdue).toBe(1);
  });

  it('does not count done tasks as overdue', () => {
    taskService.create({ title: 'Done', status: 'done', dueDate: '2000-01-01T00:00:00.000Z' });
    expect(taskService.getStats().overdue).toBe(0);
  });

  it('ignores tasks with an unrecognised status in status counts', () => {
    // Bypass route validation by calling create() directly with a non-standard status.
    // This exercises the false-branch of `if (counts[t.status] !== undefined)` in getStats.
    taskService.create({ title: 'Legacy', status: 'legacy_status' });
    const stats = taskService.getStats();
    expect(stats.todo).toBe(0);
    expect(stats.in_progress).toBe(0);
    expect(stats.done).toBe(0);
    expect(stats.overdue).toBe(0);
  });
});

// ─── update ──────────────────────────────────────────────────────────────────

describe('update', () => {
  it('updates allowed fields on an existing task', () => {
    const task = taskService.create({ title: 'Old title' });
    const updated = taskService.update(task.id, { title: 'New title', priority: 'high' });
    expect(updated.title).toBe('New title');
    expect(updated.priority).toBe('high');
  });

  it('returns null for a non-existent task', () => {
    expect(taskService.update('bad-id', { title: 'X' })).toBeNull();
  });

  it('preserves fields that were not updated', () => {
    const task = taskService.create({ title: 'A', priority: 'high' });
    const updated = taskService.update(task.id, { title: 'B' });
    expect(updated.priority).toBe('high');
  });
});

// ─── remove ──────────────────────────────────────────────────────────────────

describe('remove', () => {
  it('removes an existing task and returns true', () => {
    const task = taskService.create({ title: 'Delete me' });
    expect(taskService.remove(task.id)).toBe(true);
    expect(taskService.findById(task.id)).toBeUndefined();
  });

  it('returns false for a non-existent id', () => {
    expect(taskService.remove('bad-id')).toBe(false);
  });
});

// ─── completeTask ────────────────────────────────────────────────────────────

describe('completeTask', () => {
  it('sets status to done and records completedAt', () => {
    const task = taskService.create({ title: 'Finish me', priority: 'high' });
    const completed = taskService.completeTask(task.id);
    expect(completed.status).toBe('done');
    expect(completed.completedAt).not.toBeNull();
  });

  // BUG: completeTask unconditionally resets priority to 'medium',
  // discarding whatever priority the task previously had.
  it('should NOT reset priority when completing a task', () => {
    const task = taskService.create({ title: 'High priority', priority: 'high' });
    const completed = taskService.completeTask(task.id);
    // Priority should remain 'high', not be silently changed to 'medium'
    expect(completed.priority).toBe('high');
  });

  it('returns null for a non-existent task', () => {
    expect(taskService.completeTask('bad-id')).toBeNull();
  });
});
