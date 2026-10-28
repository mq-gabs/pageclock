import { z } from 'zod';
import { HttpError } from './errors';

function parseOrThrow<T extends z.ZodType>(schema: T, data: unknown, where: string): z.infer<T> {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  const { formErrors, fieldErrors } = z.flattenError(result.error);
  const fields = Object.fromEntries(
    Object.entries(fieldErrors).filter((entry): entry is [string, string[]] =>
      Array.isArray(entry[1]),
    ),
  );
  if (formErrors.length > 0) fields._ = formErrors;
  throw new HttpError(400, 'validation_error', `Invalid request ${where}`, fields);
}

export const parseBody = <T extends z.ZodType>(schema: T, data: unknown) =>
  parseOrThrow(schema, data, 'body');
export const parseQuery = <T extends z.ZodType>(schema: T, data: unknown) =>
  parseOrThrow(schema, data, 'query');
export const parseParams = <T extends z.ZodType>(schema: T, data: unknown) =>
  parseOrThrow(schema, data, 'params');
