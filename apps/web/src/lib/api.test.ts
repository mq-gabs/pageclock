import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { healthResponseSchema } from '@reading-tracker/shared';
import { api, ApiRequestError, ApiWarningsError } from './api';
import { clearToken, getToken, setToken } from './auth-token';

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

describe('api with a token', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => store.set(key, value),
        removeItem: (key: string) => store.delete(key),
      },
    });
    setToken('abc');
  });

  afterEach(() => {
    clearToken();
  });

  it('sends it as a bearer token', async () => {
    respond(200, { status: 'ok', time: new Date().toISOString() });
    await api('GET', '/api/health', healthResponseSchema);
    const init = vi.mocked(fetch).mock.calls[0]![1]!;
    expect(init.headers).toEqual({ Authorization: 'Bearer abc' });
  });

  it('forgets it when the API answers 401', async () => {
    respond(401, { error: { code: 'unauthorized', message: 'Sign in to continue' } });
    const error = await failure(api('GET', '/api/books', healthResponseSchema));
    expect(error).toMatchObject({ status: 401, code: 'unauthorized' });
    expect(getToken()).toBeNull();
  });

  it('keeps it for other errors', async () => {
    respond(400, { error: { code: 'validation_error', message: 'Bad' } });
    await failure(api('PUT', '/api/me/password', healthResponseSchema, {}));
    expect(getToken()).toBe('abc');
  });
});
