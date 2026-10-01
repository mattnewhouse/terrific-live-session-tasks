// Thin typed client for the Tasks API. Mirrors docs/openapi.yaml.

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const BASE = `${import.meta.env.VITE_API_URL ?? ''}/api/tasks`;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the API. Is the server running?');
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, body?.error?.code ?? 'UNKNOWN', body?.error?.message ?? res.statusText);
  }
  return body.data as T;
}

export const tasksApi = {
  list: () => request<Task[]>(''),
  create: (title: string) => request<Task>('', { method: 'POST', body: JSON.stringify({ title }) }),
  update: (id: string, changes: Partial<Pick<Task, 'title' | 'completed'>>) =>
    request<Task>(`/${id}`, { method: 'PATCH', body: JSON.stringify(changes) }),
  remove: (id: string) => request<void>(`/${id}`, { method: 'DELETE' }),
};
