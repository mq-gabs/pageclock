import { Book } from 'lucide-react';
import { cn } from '@/lib/utils';

const sizes = {
  sm: { box: 'w-12 rounded-[4px]', icon: 20 }, // 48 px wide, in rows
  md: { box: 'w-[88px] rounded-[6px]', icon: 24 }, // Book page on mobile
  lg: { box: 'w-[140px] rounded-[6px]', icon: 32 }, // Book page on desktop
} as const;

export type BookCoverSize = keyof typeof sizes;

interface BookCoverProps {
  size?: BookCoverSize;
  /** Cover image for later; the MVP has none, so the placeholder always shows. */
  src?: string;
  title?: string;
  className?: string;
}

/** Figma "Book cover / Missing": a 2:3 box in heat-0 with a centered book icon. */
export function BookCover({ size = 'sm', src, title, className }: BookCoverProps) {
  const { box, icon } = sizes[size];
  return (
    <div
      className={cn(
        'flex aspect-[2/3] shrink-0 items-center justify-center overflow-hidden border border-border bg-heat-0',
        box,
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- covers come from arbitrary URLs later
        <img src={src} alt={title ? `Cover of ${title}` : ''} className="size-full object-cover" />
      ) : (
        <Book aria-hidden size={icon} strokeWidth={1.75} className="text-muted" />
      )}
    </div>
  );
}
