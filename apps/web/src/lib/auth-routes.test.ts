import { describe, expect, it } from 'vitest';
import { isPublicRoute, safeNext, signInHref } from './auth-routes';

describe('isPublicRoute', () => {
  it('knows the sign-in and create-account pages', () => {
    expect(isPublicRoute('/sign-in')).toBe(true);
    expect(isPublicRoute('/create-account')).toBe(true);
    expect(isPublicRoute('/library')).toBe(false);
    expect(isPublicRoute('/sign-in-elsewhere')).toBe(false);
  });
});

describe('safeNext', () => {
  it('keeps a path of this app, with its query', () => {
    expect(safeNext('/books/1?x=1')).toBe('/books/1?x=1');
  });

  it.each([null, '', 'library', '//evil.com', '/\\evil.com', 'https://evil.com', '/sign-in'])(
    'falls back to the library for %j',
    (next) => {
      expect(safeNext(next)).toBe('/library');
    },
  );
});

describe('signInHref', () => {
  it('remembers where to come back to', () => {
    expect(signInHref('/stats?period=month')).toBe('/sign-in?next=%2Fstats%3Fperiod%3Dmonth');
    expect(signInHref('/library')).toBe('/sign-in');
  });
});
