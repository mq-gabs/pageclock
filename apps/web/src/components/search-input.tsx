import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  className?: string;
}

export function SearchInput({ className, ...props }: SearchInputProps) {
  return (
    <label
      className={cn(
        'flex items-center gap-2.5 rounded-input border border-border bg-surface px-3.5',
        'focus-within:ring-2 focus-within:ring-ring',
        className,
      )}
    >
      <Search aria-hidden size={18} strokeWidth={1.5} className="shrink-0 text-muted" />
      <input
        type="search"
        className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-ink placeholder:text-muted focus:outline-none"
        {...props}
      />
    </label>
  );
}
