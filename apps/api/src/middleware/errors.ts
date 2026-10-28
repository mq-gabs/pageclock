import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { ApiError } from '@reading-tracker/shared';
import { logger } from '../logger';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string[]>,
  ) {
    super(message);
  }
}

export const notFound: RequestHandler = (req, _res, next) => {
  next(new HttpError(404, 'not_found', `No route for ${req.method} ${req.path}`));
};

export const errorHandler: ErrorRequestHandler = (err: unknown, _req, res, _next) => {
  if (err instanceof HttpError) {
    const body: ApiError = { error: { code: err.code, message: err.message, fields: err.fields } };
    res.status(err.status).json(body);
    return;
  }
  if (err instanceof SyntaxError && 'body' in err) {
    const body: ApiError = {
      error: { code: 'invalid_json', message: 'Request body is not valid JSON' },
    };
    res.status(400).json(body);
    return;
  }
  logger.error({ err }, 'Unhandled error');
  const body: ApiError = { error: { code: 'internal_error', message: 'Something went wrong' } };
  res.status(500).json(body);
};
