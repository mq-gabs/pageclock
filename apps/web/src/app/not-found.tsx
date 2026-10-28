import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Page not found' };

export default function NotFound() {
  return (
    <main className="flex flex-col items-center gap-3 px-5 py-20 text-center lg:px-12">
      <h1 className="text-section-sm font-bold text-ink">Page not found</h1>
      <p className="max-w-sm text-[14px] text-muted">
        There’s nothing at this address. It may have moved, or the link is wrong.
      </p>
      <Button asChild className="mt-2">
        <Link href="/library">Go to the library</Link>
      </Button>
    </main>
  );
}
