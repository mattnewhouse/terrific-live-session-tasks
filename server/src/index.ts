import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { JsonFileTaskRepository } from './tasks/task.repository.js';

// Repo root, whether running from src/ (tsx) or dist/ (node).
const repoRoot = resolve(fileURLToPath(import.meta.url), '../../..');

const PORT = Number(process.env.PORT ?? 3001);
const DATA_FILE = resolve(process.env.DATA_FILE ?? resolve(repoRoot, 'data/tasks.json'));

const app = createApp({
  repo: new JsonFileTaskRepository(DATA_FILE),
  staticDir: resolve(repoRoot, 'client/dist'),
  openApiPath: resolve(repoRoot, 'docs/openapi.yaml'),
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}  (data file: ${DATA_FILE})`);
});
