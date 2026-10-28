import type { Metadata } from 'next';
import { bookDetailSchema } from '@reading-tracker/shared';

const apiUrl = process.env.API_URL ?? 'http://localhost:3333';

/** The book's title in the browser tab; "Book" if the API can't say. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const res = await fetch(`${apiUrl}/api/books/${encodeURIComponent(id)}`, {
      cache: 'no-store',
    });
    if (res.ok) return { title: bookDetailSchema.parse(await res.json()).book.title };
  } catch {
    // The page shows its own error state.
  }
  return { title: 'Book' };
}

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return children;
}
