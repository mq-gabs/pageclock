import * as React from 'react';
import { cn } from '@/lib/utils';

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  helper?: string;
  error?: string;
}

/** Figma "Input field": label, 48 px input, helper or error text. */
export function Field({ label, helper, error, id, className, ...props }: FieldProps) {
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
  const noteId = `${inputId}-note`;
  const note = error ?? helper;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={inputId} className="text-label font-medium text-muted">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={note ? noteId : undefined}
        className={cn(
          'h-12 w-full rounded-input border bg-surface px-3.5 text-body text-ink placeholder:text-muted',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          error ? 'border-destructive' : 'border-border',
        )}
        {...props}
      />
      {note && (
        <p id={noteId} className={cn('text-meta', error ? 'text-destructive' : 'text-muted')}>
          {note}
        </p>
      )}
    </div>
  );
}
