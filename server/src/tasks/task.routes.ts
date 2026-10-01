import { Router } from 'express';
import { HttpError } from '../errors.js';
import type { TaskRepository } from './task.repository.js';
import { createTaskSchema, listTasksQuerySchema, updateTaskSchema } from './task.schemas.js';

const notFound = (id: string) => new HttpError(404, 'TASK_NOT_FOUND', `Task ${id} not found`);

export function taskRouter(repo: TaskRepository): Router {
  const router = Router();

  // GET /api/tasks?completed=true|false
  router.get('/', async (req, res) => {
    const { completed } = listTasksQuerySchema.parse(req.query);
    res.json({ data: await repo.list({ completed }) });
  });

  router.get('/:id', async (req, res) => {
    const task = await repo.get(req.params.id);
    if (!task) throw notFound(req.params.id);
    res.json({ data: task });
  });

  router.post('/', async (req, res) => {
    const input = createTaskSchema.parse(req.body ?? {});
    const task = await repo.create(input);
    res.status(201).location(`${req.baseUrl}/${task.id}`).json({ data: task });
  });

  // Partial update: rename and/or toggle completion.
  router.patch('/:id', async (req, res) => {
    const input = updateTaskSchema.parse(req.body ?? {});
    const task = await repo.update(req.params.id, input);
    if (!task) throw notFound(req.params.id);
    res.json({ data: task });
  });

  router.delete('/:id', async (req, res) => {
    const removed = await repo.delete(req.params.id);
    if (!removed) throw notFound(req.params.id);
    res.status(204).end();
  });

  return router;
}
