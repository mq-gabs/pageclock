import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// Our font-size tokens (`text-label`, `text-meta`, …) would otherwise be read as text colors,
// and `cn('text-label', 'text-muted')` would drop the size.
const twMerge = extendTailwindMerge({
  extend: {
    theme: { text: ['title', 'title-sm', 'section', 'section-sm', 'body', 'label', 'meta'] },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
