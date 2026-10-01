import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { CreateTaskInput, Task, UpdateTaskInput } from './task.types.js';

/**
 * Storage abstraction. The POC ships an in-memory implementation and a JSON-file
 * one; a production version would add e.g. a Postgres implementation behind the
 * same interface without touching the HTTP layer.
 */
export interface TaskRepository {
  list(filter?: { completed?: boolean }): Promise<Task[]>;
  get(id: string): Promise<Task | undefined>;
  create(input: CreateTaskInput): Promise<Task>;
  update(id: string, input: UpdateTaskInput): Promise<Task | undefined>;
  delete(id: string): Promise<boolean>;
}

export class InMemoryTaskRepository implements TaskRepository {
  protected tasks = new Map<string, Task>();

  constructor(seed: Task[] = []) {
    for (const task of seed) this.tasks.set(task.id, task);
  }

  async list(filter: { completed?: boolean } = {}): Promise<Task[]> {
    // Map preserves insertion order, i.e. creation order.
    return [...this.tasks.values()].filter(
      (t) => filter.completed === undefined || t.completed === filter.completed,
    );
  }

  async get(id: string): Promise<Task | undefined> {
    return this.tasks.get(id);
  }

  async create(input: CreateTaskInput): Promise<Task> {
    const now = new Date().toISOString();
    const task: Task = { id: randomUUID(), title: input.title, completed: false, createdAt: now, updatedAt: now };
    this.tasks.set(task.id, task);
    await this.persist();
    return task;
  }

  async update(id: string, input: UpdateTaskInput): Promise<Task | undefined> {
    const existing = this.tasks.get(id);
    if (!existing) return undefined;
    const updated: Task = {
      ...existing,
      ...(input.title !== undefined && { title: input.title }),
      ...(input.completed !== undefined && { completed: input.completed }),
      updatedAt: new Date().toISOString(),
    };
    this.tasks.set(id, updated);
    await this.persist();
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const removed = this.tasks.delete(id);
    if (removed) await this.persist();
    return removed;
  }

  protected async persist(): Promise<void> {
    // no-op for the in-memory store
  }
}

/**
 * Keeps everything in memory and snapshots the full list to a JSON file after
 * every write, so data survives restarts. Good enough for a handful of internal
 * users on a single instance; NOT safe for multiple processes/instances.
 */
export class JsonFileTaskRepository extends InMemoryTaskRepository {
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {
    super(JsonFileTaskRepository.load(filePath));
  }

  private static load(filePath: string): Task[] {
    if (!existsSync(filePath)) return [];
    const raw = readFileSync(filePath, 'utf8');
    if (!raw.trim()) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error(`Invalid data file ${filePath}: expected a JSON array`);
    return parsed as Task[];
  }

  protected override persist(): Promise<void> {
    const snapshot = JSON.stringify([...this.tasks.values()], null, 2);
    // Serialize writes and write-then-rename so a crash never leaves a half-written file.
    const write = async () => {
      await mkdir(dirname(this.filePath), { recursive: true });
      const tmp = `${this.filePath}.tmp`;
      await writeFile(tmp, snapshot, 'utf8');
      await rename(tmp, this.filePath);
    };
    const next = this.writeQueue.then(write, write);
    this.writeQueue = next.catch(() => undefined);
    return next;
  }
}
