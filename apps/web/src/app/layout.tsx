import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AppShell } from '@/components/app-shell';
import { Providers } from './providers';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: { default: 'Pageclock', template: '%s · Pageclock' },
  description: 'Track books, reading sessions and reading speed.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
