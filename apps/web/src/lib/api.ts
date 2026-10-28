import {
  apiErrorSchema,
  apiWarningsResponseSchema,
  type ApiWarning,
} from '@reading-tracker/shared';
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

/** A 409 with `{ warnings }` (rule 4): resend with `confirmWarnings: true` to save anyway. */
export class ApiWarningsError extends Error {
  constructor(readonly warnings: ApiWarning[]) {
    super('Check the warnings before saving');
  }
}

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

async function send(method: Method, path: string, body?: unknown): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    // fetch only rejects when no response arrives (offline, API down, CORS).
    throw new ApiRequestError(
      0,
      'network_error',
      'Can’t reach the server. Check your connection and try again.',
    );
  }
  if (res.ok) return res;

  const json: unknown = await res.json().catch(() => null);
  if (res.status === 409) {
    const warnings = apiWarningsResponseSchema.safeParse(json);
    if (warnings.success) throw new ApiWarningsError(warnings.data.warnings);
  }
  const parsed = apiErrorSchema.safeParse(json);
  if (parsed.success) {
    const { code, message, fields } = parsed.data.error;
    throw new ApiRequestError(res.status, code, message, fields);
  }
  // No API error body: usually the Next proxy answering because the API is down.
  const message =
    res.status >= 500
      ? 'The server ran into a problem. Try again in a moment.'
      : `Request failed (${res.status})`;
  throw new ApiRequestError(res.status, 'http_error', message);
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
