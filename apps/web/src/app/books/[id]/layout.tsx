import type { Metadata } from 'next';

// Static on purpose: Next prefetches this layout (down to loading.tsx) before a click, so it must
// not wait on the API. "Book" is only the fallback: BookView renders a <title> with the book's own
// title once it has loaded, which wins over this one.
export const metadata: Metadata = { title: 'Book' };

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return children;
}
