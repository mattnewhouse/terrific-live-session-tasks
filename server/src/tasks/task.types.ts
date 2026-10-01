export interface Task {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string; // ISO-8601
  updatedAt: string; // ISO-8601
}

export interface CreateTaskInput {
  title: string;
}

export interface UpdateTaskInput {
  title?: string;
  completed?: boolean;
}
