'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { BookOpen, ChartColumn, Settings, Timer, type LucideIcon } from 'lucide-react';
import { isPublicRoute, safeNext, signInHref } from '@/lib/auth-routes';
import { useAuthToken } from '@/lib/auth-token';
import { useAppRouter } from '@/lib/navigation-progress';
import { cn } from '@/lib/utils';
import { NowReadingCard } from './now-reading-card';
import { AppLink } from './app-link';
import { NavigationProgress } from './navigation-progress';
import { PageclockWordmark } from './logo';

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
  {
    href: '/settings',
    label: 'Settings',
    icon: Settings,
    matches: (p) => p.startsWith('/settings'),
  },
];

/** Figma "Sidebar" (from 1024 px), with the "Now reading" card at the bottom. */
function Sidebar({ path }: { path: string }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-7 border-r border-border bg-surface px-4 pt-7 pb-6 lg:flex">
      <AppLink href="/library" aria-label="Pageclock, go to Library" className="flex pl-2">
        <PageclockWordmark className="h-7" />
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

/**
 * Signed-out users only see the sign-in and create-account pages; signed-in users only the app.
 * The token lives in the browser, so the server renders a blank page and the client decides.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const token = useAuthToken();
  const router = useAppRouter();
  const isPublic = isPublicRoute(path);
  const redirect =
    token === undefined ? null : isPublic && token ? 'app' : !isPublic && !token ? 'sign-in' : null;

  useEffect(() => {
    if (redirect === 'app') {
      router.replace(safeNext(new URLSearchParams(window.location.search).get('next')));
    } else if (redirect === 'sign-in') {
      router.replace(signInHref(window.location.pathname + window.location.search));
    }
  }, [redirect, router]);

  if (token === undefined || redirect) {
    return (
      <>
        <NavigationProgress />
        <div className="min-h-screen bg-bg" />
      </>
    );
  }

  if (isPublic) {
    return (
      <>
        <NavigationProgress />
        {children}
      </>
    );
  }

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
