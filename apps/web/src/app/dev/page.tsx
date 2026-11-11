import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DevView } from './dev-view';

export const metadata: Metadata = { title: 'Dev' };

/** Playground for manual UI checks. Not linked anywhere and a 404 in production builds. */
export default function DevPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <DevView />;
}
