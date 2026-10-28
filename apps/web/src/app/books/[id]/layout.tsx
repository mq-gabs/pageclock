import type { Metadata } from 'next';

// Static on purpose: Next prefetches this layout (down to loading.tsx) before a click, so it must
// not wait on the API. BookView puts the book's own title in the tab once it has loaded.
export const metadata: Metadata = { title: 'Book' };

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return children;
}
