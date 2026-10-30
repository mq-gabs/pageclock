/** Routes anyone can open; every other route needs a signed-in user. */
export const publicRoutes = ['/sign-in', '/create-account'] as const;

export const isPublicRoute = (path: string) =>
  publicRoutes.some((route) => path === route || path.startsWith(`${route}/`));

const defaultNext = '/library';

/**
 * Where to go after signing in: the `?next=` path if it is a page of this app, else the
 * library. Refuses other origins (`//evil.com`, `https://…`) and the auth pages themselves.
 */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) {
    return defaultNext;
  }
  const path = next.split(/[?#]/)[0] ?? '';
  return isPublicRoute(path) ? defaultNext : next;
}

/** The sign-in URL that comes back to `path` (with its query) afterwards. */
export function signInHref(path: string): string {
  return path === '/' || path === defaultNext
    ? '/sign-in'
    : `/sign-in?next=${encodeURIComponent(path)}`;
}
