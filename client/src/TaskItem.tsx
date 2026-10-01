import { useState } from 'react';
import type { Task } from './api';

interface Props {
  task: Task;
  onUpdate: (id: string, changes: { title?: string; completed?: boolean }) => Promise<boolean>;
  onDelete: (id: string) => Promise<void>;
}

export function TaskItem({ task, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);

  const startEdit = () => {
    setDraft(task.title);
    setEditing(true);
  };

  const save = async () => {
    const title = draft.trim();
    if (!title || title === task.title) {
      setEditing(false);
      return;
    }
    if (await onUpdate(task.id, { title })) setEditing(false);
  };

  return (
    <li className={`task ${task.completed ? 'completed' : ''}`}>
      <input
        type="checkbox"
        aria-label={`Mark "${task.title}" as ${task.completed ? 'not completed' : 'completed'}`}
        checked={task.completed}
        onChange={(e) => void onUpdate(task.id, { completed: e.target.checked })}
      />

      {editing ? (
        <form
          className="edit"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <input
            autoFocus
            aria-label="Task title"
            value={draft}
            maxLength={200}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}
          />
          <button type="submit">Save</button>
          <button type="button" className="secondary" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </form>
      ) : (
        <>
          <span className="title" onDoubleClick={startEdit} title="Double-click to edit">
            {task.title}
          </span>
          <button className="secondary" onClick={startEdit}>
            Edit
          </button>
          <button
            className="danger"
            onClick={() => {
              if (confirm(`Delete "${task.title}"?`)) void onDelete(task.id);
            }}
          >
            Delete
          </button>
        </>
      )}
    </li>
  );
}
