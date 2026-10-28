import { afterEach, describe, expect, it, vi } from 'vitest';
import { healthResponseSchema } from '@reading-tracker/shared';
import { api, ApiRequestError, ApiWarningsError } from './api';

const respond = (status: number, body?: unknown) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      body === undefined
        ? new Response('<html>Internal Server Error</html>', { status })
        : Response.json(body, { status }),
    ),
  );

const failure = (promise: Promise<unknown>) =>
  promise.then(
    () => {
      throw new Error('expected a rejection');
    },
    (error: unknown) => error,
  );

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('api', () => {
  it('returns the validated body', async () => {
    const time = new Date().toISOString();
    respond(200, { status: 'ok', time });
    await expect(api('GET', '/api/health', healthResponseSchema)).resolves.toEqual({
      status: 'ok',
      time,
    });
  });

  it('turns an API error body into ApiRequestError with fields', async () => {
    respond(400, { error: { code: 'validation_error', message: 'Bad', fields: { title: ['x'] } } });
    const error = await failure(api('POST', '/api/books', healthResponseSchema, {}));
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({
      status: 400,
      code: 'validation_error',
      fields: { title: ['x'] },
    });
  });

  it('turns a 409 with warnings into ApiWarningsError', async () => {
    respond(409, { warnings: [{ code: 'page_gap_before', message: 'Gap' }] });
    const error = await failure(api('POST', '/api/reading-sessions', healthResponseSchema, {}));
    expect(error).toBeInstanceOf(ApiWarningsError);
  });

  it('explains a server error without an API body', async () => {
    respond(502);
    const error = await failure(api('GET', '/api/books', healthResponseSchema));
    expect(error).toMatchObject({ status: 502, code: 'http_error' });
    expect((error as Error).message).toBe('The server ran into a problem. Try again in a moment.');
  });

  it('explains a network failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    const error = await failure(api('GET', '/api/books', healthResponseSchema));
    expect(error).toMatchObject({ status: 0, code: 'network_error' });
    expect((error as Error).message).toContain('Can’t reach the server');
  });
});
