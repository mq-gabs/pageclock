'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AppLink } from '@/components/app-link';

/** Unexpected render errors in any page: the shell stays, the page offers a retry. */
export default function PageError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-col items-center gap-3 px-5 py-20 text-center lg:px-12">
      <h1 className="text-section-sm font-bold text-ink">Something went wrong</h1>
      <p role="alert" className="max-w-sm text-[14px] text-muted">
        This page hit an unexpected error. Your books and sessions are safe.
      </p>
      <div className="mt-2 flex gap-2.5">
        <Button variant="secondary" onClick={() => retry()}>
          Try again
        </Button>
        <Button asChild>
          <AppLink href="/library">Go to the library</AppLink>
        </Button>
      </div>
    </main>
  );
}
