import { z } from 'zod';

export const TITLE_MAX_LENGTH = 200;

const title = z
  .string({ required_error: 'title is required', invalid_type_error: 'title must be a string' })
  .trim()
  .min(1, 'title must not be empty')
  .max(TITLE_MAX_LENGTH, `title must be at most ${TITLE_MAX_LENGTH} characters`);

export const createTaskSchema = z.object({ title }).strict();

export const updateTaskSchema = z
  .object({
    title: title.optional(),
    completed: z.boolean({ invalid_type_error: 'completed must be a boolean' }).optional(),
  })
  .strict()
  .refine((body) => body.title !== undefined || body.completed !== undefined, {
    message: 'provide at least one of: title, completed',
  });

export const listTasksQuerySchema = z.object({
  completed: z
    .enum(['true', 'false'], { message: "completed must be 'true' or 'false'" })
    .transform((v) => v === 'true')
    .optional(),
});
