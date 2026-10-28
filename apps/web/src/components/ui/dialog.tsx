'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;
const DialogTitle = DialogPrimitive.Title;
const DialogDescription = DialogPrimitive.Description;

/** Full screen below 1024 px, a centered card from 1024 px (SPEC › UI › Breakpoints). */
function DialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-ink/40" />
      <DialogPrimitive.Content
        className={cn(
          'fixed inset-0 z-50 flex flex-col gap-5 overflow-y-auto bg-surface px-5 pt-6 pb-5 focus:outline-none',
          'lg:inset-auto lg:top-1/2 lg:left-1/2 lg:max-h-[calc(100vh-4rem)] lg:w-[480px] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-card lg:border lg:border-border lg:p-7',
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger };
