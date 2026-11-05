import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AppShell } from '@/components/app-shell';
import { themeScript } from '@/lib/theme-script';
import { Providers } from './providers';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: { default: 'Pageclock', template: '%s · Pageclock' },
  description: 'Track books, reading sessions and reading speed.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The theme script sets `data-theme` before hydration.
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
