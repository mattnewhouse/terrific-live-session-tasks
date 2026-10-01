import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { InMemoryTaskRepository, JsonFileTaskRepository } from '../src/tasks/task.repository.js';

let app: ReturnType<typeof createApp>;

beforeEach(() => {
  app = createApp({ repo: new InMemoryTaskRepository() });
});

const createTask = async (title = 'Check stream key') =>
  (await request(app).post('/api/tasks').send({ title }).expect(201)).body.data;

describe('Tasks API', () => {
  it('GET /api/health', async () => {
    await request(app).get('/api/health').expect(200, { status: 'ok' });
  });

  it('creates a task (trimmed title, defaults, Location header)', async () => {
    const res = await request(app).post('/api/tasks').send({ title: '  Upload product catalog ' }).expect(201);
    expect(res.body.data).toMatchObject({ title: 'Upload product catalog', completed: false });
    expect(res.body.data.id).toEqual(expect.any(String));
    expect(res.headers.location).toBe(`/api/tasks/${res.body.data.id}`);
  });

  it('lists tasks in creation order and filters by completion', async () => {
    const a = await createTask('A');
    await createTask('B');
    await request(app).patch(`/api/tasks/${a.id}`).send({ completed: true }).expect(200);

    const all = await request(app).get('/api/tasks').expect(200);
    expect(all.body.data.map((t: { title: string }) => t.title)).toEqual(['A', 'B']);

    const done = await request(app).get('/api/tasks?completed=true').expect(200);
    expect(done.body.data.map((t: { title: string }) => t.title)).toEqual(['A']);

    await request(app).get('/api/tasks?completed=maybe').expect(400);
  });

  it('gets a single task', async () => {
    const task = await createTask();
    const res = await request(app).get(`/api/tasks/${task.id}`).expect(200);
    expect(res.body.data).toEqual(task);
  });

  it('updates title and completion', async () => {
    const task = await createTask();
    const renamed = await request(app).patch(`/api/tasks/${task.id}`).send({ title: 'Renamed' }).expect(200);
    expect(renamed.body.data).toMatchObject({ title: 'Renamed', completed: false });

    const done = await request(app).patch(`/api/tasks/${task.id}`).send({ completed: true }).expect(200);
    expect(done.body.data).toMatchObject({ title: 'Renamed', completed: true });
    expect(done.body.data.createdAt).toBe(task.createdAt);
  });

  it('deletes a task', async () => {
    const task = await createTask();
    await request(app).delete(`/api/tasks/${task.id}`).expect(204);
    await request(app).get(`/api/tasks/${task.id}`).expect(404);
    await request(app).delete(`/api/tasks/${task.id}`).expect(404);
  });

  describe('validation & errors', () => {
    it.each([
      [{}, 'title is required'],
      [{ title: '   ' }, 'title must not be empty'],
      [{ title: 42 }, 'title must be a string'],
      [{ title: 'x'.repeat(201) }, 'at most 200'],
      [{ title: 'ok', completed: true }, 'Unrecognized key'],
    ])('rejects invalid create body %j', async (body, message) => {
      const res = await request(app).post('/api/tasks').send(body).expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain(message);
    });

    it('rejects empty or invalid patch bodies', async () => {
      const task = await createTask();
      await request(app).patch(`/api/tasks/${task.id}`).send({}).expect(400);
      await request(app).patch(`/api/tasks/${task.id}`).send({ completed: 'yes' }).expect(400);
    });

    it('returns 404 for unknown task ids and routes', async () => {
      const res = await request(app).patch('/api/tasks/nope').send({ completed: true }).expect(404);
      expect(res.body.error.code).toBe('TASK_NOT_FOUND');
      await request(app).get('/api/nope').expect(404);
    });

    it('returns 400 for malformed JSON', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .set('Content-Type', 'application/json')
        .send('{"title":')
        .expect(400);
      expect(res.body.error.code).toBe('INVALID_JSON');
    });
  });
});

describe('JsonFileTaskRepository', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tasks-test-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('persists tasks across instances', async () => {
    const file = join(dir, 'nested', 'tasks.json');
    const repo = new JsonFileTaskRepository(file);
    const task = await repo.create({ title: 'Persist me' });
    await repo.update(task.id, { completed: true });

    expect(JSON.parse(readFileSync(file, 'utf8'))).toHaveLength(1);
    const reloaded = new JsonFileTaskRepository(file);
    expect(await reloaded.get(task.id)).toMatchObject({ title: 'Persist me', completed: true });
  });
});
