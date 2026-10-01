import cors from 'cors';
import express from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { errorHandler, notFoundHandler } from './errors.js';
import type { TaskRepository } from './tasks/task.repository.js';
import { taskRouter } from './tasks/task.routes.js';

export interface AppOptions {
  repo: TaskRepository;
  /** Directory of the built React app; served at / when present (single-process deploy). */
  staticDir?: string;
  /** Path to the OpenAPI document, served at /api/openapi.yaml when present. */
  openApiPath?: string;
}

export function createApp({ repo, staticDir, openApiPath }: AppOptions) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors()); // open CORS: internal POC without auth (see README)
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  if (openApiPath && existsSync(openApiPath)) {
    app.get('/api/openapi.yaml', (_req, res) => {
      res.type('text/yaml').sendFile(openApiPath);
    });
  }

  app.use('/api/tasks', taskRouter(repo));
  app.use('/api', notFoundHandler);

  if (staticDir && existsSync(join(staticDir, 'index.html'))) {
    app.use(express.static(staticDir));
    // SPA fallback for any non-API GET
    app.get(/.*/, (_req, res) => res.sendFile(join(staticDir, 'index.html')));
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
