'use client';

import { usePathname } from 'next/navigation';
import { BookOpen, ChartColumn, Timer, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NowReadingCard } from './now-reading-card';
import { AppLink } from './app-link';
import { NavigationProgress } from './navigation-progress';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  matches: (path: string) => boolean;
}

const navItems: NavItem[] = [
  {
    href: '/library',
    label: 'Library',
    icon: BookOpen,
    matches: (p) => p.startsWith('/library') || p.startsWith('/books'),
  },
  { href: '/read', label: 'Read', icon: Timer, matches: (p) => p.startsWith('/read') },
  { href: '/stats', label: 'Stats', icon: ChartColumn, matches: (p) => p.startsWith('/stats') },
];

/** Figma "Sidebar" (from 1024 px), with the "Now reading" card at the bottom. */
function Sidebar({ path }: { path: string }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-7 border-r border-border bg-surface px-4 pt-7 pb-6 lg:flex">
      <AppLink href="/library" className="flex items-center gap-2.5 pl-2">
        <span className="flex size-[30px] items-center justify-center rounded-[8px] bg-accent">
          <BookOpen aria-hidden size={16} className="text-surface" />
        </span>
        <span className="text-[15px] font-bold text-ink">Reading Tracker</span>
      </AppLink>
      <nav aria-label="Main" className="flex flex-col gap-1">
        {navItems.map(({ href, label, icon: Icon, matches }) => {
          const active = matches(path);
          return (
            <AppLink
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-[8px] px-3 py-2.5 text-[14px] transition-colors',
                active
                  ? 'bg-accent-tint font-semibold text-accent'
                  : 'font-medium text-muted hover:bg-bg',
              )}
            >
              <Icon aria-hidden size={20} />
              {label}
            </AppLink>
          );
        })}
      </nav>
      <div className="mt-auto">
        <NowReadingCard />
      </div>
    </aside>
  );
}

/** Figma "Nav bar" (below 1024 px). */
function BottomNav({ path }: { path: string }) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 flex h-16 border-t border-border bg-surface pt-2.5 pb-[18px] lg:hidden"
    >
      {navItems.map(({ href, label, icon: Icon, matches }) => {
        const active = matches(path);
        return (
          <AppLink
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex flex-1 flex-col items-center gap-1 text-[11px]',
              active ? 'font-semibold text-accent' : 'font-medium text-muted',
            )}
          >
            <Icon aria-hidden size={22} />
            {label}
          </AppLink>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <div className="min-h-screen lg:flex">
      <NavigationProgress />
      <a
        href="#content"
        className="sr-only z-50 rounded-button border border-border bg-surface font-semibold text-accent shadow-sm focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:px-4 focus:py-2"
      >
        Skip to content
      </a>
      <Sidebar path={path} />
      <div id="content" tabIndex={-1} className="min-w-0 flex-1 pb-16 outline-none lg:pb-0">
        {children}
      </div>
      <BottomNav path={path} />
    </div>
  );
}
