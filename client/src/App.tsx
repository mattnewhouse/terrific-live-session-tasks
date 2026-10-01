import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError, tasksApi, type Task } from './api';
import { TaskItem } from './TaskItem';

type Filter = 'all' | 'open' | 'done';

export function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const fail = (e: unknown) => setError(e instanceof ApiError ? e.message : 'Unexpected error');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTasks(await tasksApi.list());
      setError(null);
    } catch (e) {
      fail(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const replace = (task: Task) => setTasks((ts) => ts.map((t) => (t.id === task.id ? task : t)));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      const task = await tasksApi.create(newTitle);
      setTasks((ts) => [...ts, task]);
      setNewTitle('');
      setError(null);
    } catch (err) {
      fail(err);
    }
  };

  const handleUpdate = async (id: string, changes: { title?: string; completed?: boolean }) => {
    try {
      replace(await tasksApi.update(id, changes));
      setError(null);
      return true;
    } catch (err) {
      fail(err);
      return false;
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await tasksApi.remove(id);
      setTasks((ts) => ts.filter((t) => t.id !== id));
      setError(null);
    } catch (err) {
      fail(err);
    }
  };

  const doneCount = tasks.filter((t) => t.completed).length;
  const visible = useMemo(
    () => tasks.filter((t) => (filter === 'all' ? true : filter === 'done' ? t.completed : !t.completed)),
    [tasks, filter],
  );

  return (
    <main className="container">
      <header>
        <h1>Live Session Setup</h1>
        <p className="subtitle">Preparation checklist for the upcoming live commerce session</p>
      </header>

      <form className="new-task" onSubmit={handleCreate}>
        <input
          aria-label="New task title"
          placeholder="e.g. Configure product carousel"
          value={newTitle}
          maxLength={200}
          onChange={(e) => setNewTitle(e.target.value)}
        />
        <button type="submit" disabled={!newTitle.trim()}>
          Add task
        </button>
      </form>

      {error && (
        <div className="error" role="alert">
          <span>{error}</span>
          <button className="link" onClick={() => void load()}>
            Retry
          </button>
        </div>
      )}

      <div className="toolbar">
        <span className="progress">
          {doneCount}/{tasks.length} completed
        </span>
        <div className="filters" role="group" aria-label="Filter tasks">
          {(['all', 'open', 'done'] as const).map((f) => (
            <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
              {f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="empty">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="empty">{tasks.length === 0 ? 'No tasks yet. Add the first one above.' : 'Nothing here.'}</p>
      ) : (
        <ul className="task-list">
          {visible.map((task) => (
            <TaskItem key={task.id} task={task} onUpdate={handleUpdate} onDelete={handleDelete} />
          ))}
        </ul>
      )}
    </main>
  );
}
