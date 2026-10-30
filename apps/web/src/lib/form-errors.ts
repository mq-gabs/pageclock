import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiRequestError } from './api';

/**
 * Puts an API error's `fields` onto the matching inputs; anything else (or an error without
 * fields for these inputs) becomes the form's root error.
 */
export function setApiErrors<T extends FieldValues>(
  setError: UseFormSetError<T>,
  error: unknown,
  fields: readonly Path<T>[],
) {
  let mapped = false;
  if (error instanceof ApiRequestError) {
    for (const field of fields) {
      const message = error.fields[field]?.[0];
      if (message) {
        setError(field, { message });
        mapped = true;
      }
    }
  }
  if (!mapped) {
    const message = error instanceof Error ? error.message : 'Something went wrong. Try again.';
    setError('root', { message });
  }
}
