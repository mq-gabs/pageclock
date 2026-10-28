'use client';

import Link, { useLinkStatus } from 'next/link';
import { useReportPending } from '@/lib/navigation-progress';

function PendingReporter() {
  useReportPending(useLinkStatus().pending);
  return null;
}

/** `next/link` that drives the top navigation bar while its route is loading. */
export function AppLink({ children, ...props }: React.ComponentProps<typeof Link>) {
  return (
    <Link {...props}>
      {children}
      <PendingReporter />
    </Link>
  );
}

/**
 * A link that opens a dialog on the current page: a plain click updates the URL with
 * `history.pushState` (no server round trip) and calls `onOpen`; modified clicks (new tab,
 * new window) keep the normal link behaviour, and the URL works on its own after a reload.
 */
export function LocalLink({
  onOpen,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; onOpen: () => void }) {
  return (
    <a
      {...props}
      onClick={(event) => {
        props.onClick?.(event);
        if (event.defaultPrevented || event.button !== 0) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        onOpen();
      }}
    />
  );
}
