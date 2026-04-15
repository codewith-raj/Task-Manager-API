const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Task Manager API',
      version: '1.0.0',
      description:
        'A simple in-memory Task Manager API built with Node.js & Express. ' +
        'Supports creating, listing, updating, deleting, completing, and assigning tasks.',
    },
    servers: [
      {
        // Render sets RENDER_EXTERNAL_URL automatically (full https URL).
        // Falls back to localhost for local development.
        url: process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000',
        description: process.env.RENDER_EXTERNAL_URL ? 'Production (Render)' : 'Local development',
      },
    ],
    components: {
      schemas: {
        Task: {
          type: 'object',
          properties: {
            id:          { type: 'string', format: 'uuid', example: 'a1b2c3d4-...' },
            title:       { type: 'string', example: 'Write unit tests' },
            description: { type: 'string', example: 'Cover all edge cases' },
            status: {
              type: 'string',
              enum: ['todo', 'in_progress', 'done'],
              example: 'todo',
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
              example: 'high',
            },
            dueDate:     { type: 'string', format: 'date-time', nullable: true, example: '2026-04-20T00:00:00.000Z' },
            completedAt: { type: 'string', format: 'date-time', nullable: true, example: null },
            assignee:    { type: 'string', nullable: true, example: 'Alice' },
            createdAt:   { type: 'string', format: 'date-time', example: '2026-04-15T10:00:00.000Z' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Task not found' },
          },
        },
        Stats: {
          type: 'object',
          properties: {
            todo:        { type: 'integer', example: 3 },
            in_progress: { type: 'integer', example: 1 },
            done:        { type: 'integer', example: 2 },
            overdue:     { type: 'integer', example: 1 },
          },
        },
      },
    },
    paths: {
      '/tasks': {
        get: {
          summary: 'List all tasks',
          description: 'Returns all tasks. Supports optional filtering by status and pagination.',
          tags: ['Tasks'],
          parameters: [
            {
              name: 'status', in: 'query', schema: { type: 'string', enum: ['todo', 'in_progress', 'done'] },
              description: 'Filter tasks by status',
            },
            {
              name: 'page', in: 'query', schema: { type: 'integer', default: 1 },
              description: 'Page number (1-indexed)',
            },
            {
              name: 'limit', in: 'query', schema: { type: 'integer', default: 10 },
              description: 'Number of tasks per page',
            },
          ],
          responses: {
            200: {
              description: 'Array of tasks',
              content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Task' } } } },
            },
          },
        },
        post: {
          summary: 'Create a new task',
          tags: ['Tasks'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['title'],
                  properties: {
                    title:       { type: 'string', example: 'Write unit tests' },
                    description: { type: 'string', example: 'Cover all edge cases' },
                    status:      { type: 'string', enum: ['todo', 'in_progress', 'done'], example: 'todo' },
                    priority:    { type: 'string', enum: ['low', 'medium', 'high'], example: 'high' },
                    dueDate:     { type: 'string', format: 'date-time', example: '2026-04-20T00:00:00.000Z' },
                  },
                },
              },
            },
          },
          responses: {
            201: {
              description: 'Task created successfully',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Task' } } },
            },
            400: {
              description: 'Validation error',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
          },
        },
      },

      '/tasks/stats': {
        get: {
          summary: 'Get task statistics',
          description: 'Returns counts by status and the number of overdue tasks.',
          tags: ['Tasks'],
          responses: {
            200: {
              description: 'Statistics object',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Stats' } } },
            },
          },
        },
      },

      '/tasks/{id}': {
        put: {
          summary: 'Update a task',
          description: 'Full (or partial) update of any task fields.',
          tags: ['Tasks'],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    title:       { type: 'string', example: 'Updated title' },
                    description: { type: 'string' },
                    status:      { type: 'string', enum: ['todo', 'in_progress', 'done'] },
                    priority:    { type: 'string', enum: ['low', 'medium', 'high'] },
                    dueDate:     { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Updated task', content: { 'application/json': { schema: { $ref: '#/components/schemas/Task' } } } },
            400: { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            404: { description: 'Task not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
        delete: {
          summary: 'Delete a task',
          tags: ['Tasks'],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            204: { description: 'Task deleted — no content returned' },
            404: { description: 'Task not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },

      '/tasks/{id}/complete': {
        patch: {
          summary: 'Mark a task as complete',
          description: 'Sets status to `done` and records `completedAt`. Task priority is preserved.',
          tags: ['Tasks'],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Completed task', content: { 'application/json': { schema: { $ref: '#/components/schemas/Task' } } } },
            404: { description: 'Task not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },

      '/tasks/{id}/assign': {
        patch: {
          summary: 'Assign a task to a user',
          description:
            'Stores an assignee name on the task. Must be a non-empty string. ' +
            'Reassigning an already-assigned task is allowed.',
          tags: ['Tasks'],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['assignee'],
                  properties: {
                    assignee: { type: 'string', example: 'Alice' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Updated task with assignee', content: { 'application/json': { schema: { $ref: '#/components/schemas/Task' } } } },
            400: { description: 'Invalid assignee value', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            404: { description: 'Task not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
    },
  },
  apis: [], // spec is defined inline above
};

module.exports = swaggerJsdoc(options);
