import { apiErrorSchema } from '@reading-tracker/shared';
import type { z } from 'zod';

/** A non-2xx response, carrying the API's `{ error: { code, message, fields } }` body. */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields: Record<string, string[]> = {},
  ) {
    super(message);
  }
}

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

async function send(method: Method, path: string, body?: unknown): Promise<Response> {
  const res = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.ok) return res;

  const parsed = apiErrorSchema.safeParse(await res.json().catch(() => null));
  if (parsed.success) {
    const { code, message, fields } = parsed.data.error;
    throw new ApiRequestError(res.status, code, message, fields);
  }
  throw new ApiRequestError(res.status, 'http_error', `Request failed (${res.status})`);
}

/** Calls the API and validates the JSON response with `schema`. */
export async function api<S extends z.ZodType>(
  method: Method,
  path: string,
  schema: S,
  body?: unknown,
): Promise<z.infer<S>> {
  const res = await send(method, path, body);
  return schema.parse(await res.json());
}

/** Calls an endpoint that answers 204 No Content. */
export async function apiNoContent(method: Method, path: string): Promise<void> {
  await send(method, path);
}
