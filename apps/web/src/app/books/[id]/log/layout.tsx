import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Log session' };

export default function LogSessionLayout({ children }: { children: React.ReactNode }) {
  return children;
}
