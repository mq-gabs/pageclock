'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSearchParams } from 'next/navigation';
import { signInSchema, signUpSchema, userLimits } from '@reading-tracker/shared';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { safeNext } from '@/lib/auth-routes';
import { setApiErrors } from '@/lib/form-errors';
import { useAppRouter } from '@/lib/navigation-progress';
import { useSignIn, useSignUp } from '@/lib/queries';
import { AppLink } from './app-link';
import { Field } from './field';
import { PageclockWordmark } from './logo';

/** The centered card the sign-in and create-account pages share. */
function AuthCard({
  title,
  description,
  footer,
  children,
}: {
  title: string;
  description: string;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center px-4 pt-12 pb-10 lg:justify-center lg:pt-10">
      <div className="flex w-full max-w-[400px] flex-col gap-7">
        <PageclockWordmark className="h-8 self-center" />
        <section className="flex flex-col gap-5 rounded-card border border-border bg-surface p-6 lg:p-8">
          <div className="flex flex-col gap-1">
            <h1 className="text-section-sm font-bold text-ink">{title}</h1>
            <p className="text-[14px] text-muted">{description}</p>
          </div>
          {children}
        </section>
        <p className="text-center text-[14px] text-muted">{footer}</p>
      </div>
    </main>
  );
}

const linkClass = 'rounded-[4px] font-semibold text-accent hover:underline';

function RootError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-meta text-destructive">
      {message}
    </p>
  );
}

/** Keeps `?next=` when switching between sign-in and create-account. */
function useNext() {
  const next = useSearchParams().get('next');
  return { next: safeNext(next), query: next ? `?next=${encodeURIComponent(next)}` : '' };
}

type SignInInput = z.input<typeof signInSchema>;
type SignInOutput = z.output<typeof signInSchema>;

export function SignInForm() {
  const router = useAppRouter();
  const { next, query } = useNext();
  const signIn = useSignIn();
  const form = useForm<SignInInput, unknown, SignInOutput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { nick: '', password: '' },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (input) => {
    try {
      await signIn.mutateAsync(input);
      router.replace(next);
    } catch (error) {
      setApiErrors(form.setError, error, ['nick', 'password']);
    }
  });

  return (
    <AuthCard
      title="Sign in"
      description="Welcome back. Sign in to see your books and reading time."
      footer={
        <>
          New to Pageclock?{' '}
          <AppLink href={`/create-account${query}`} className={linkClass}>
            Create an account
          </AppLink>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <Field
          label="Nick"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
          error={errors.nick?.message}
          {...form.register('nick')}
        />
        <Field
          label="Password"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...form.register('password')}
        />
        <RootError message={errors.root?.message} />
        <Button type="submit" disabled={isSubmitting} className="mt-1">
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthCard>
  );
}

type SignUpInput = z.input<typeof signUpSchema>;
type SignUpOutput = z.output<typeof signUpSchema>;

export function CreateAccountForm() {
  const router = useAppRouter();
  const { next, query } = useNext();
  const signUp = useSignUp();
  const form = useForm<SignUpInput, unknown, SignUpOutput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: '', nick: '', password: '' },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (input) => {
    try {
      await signUp.mutateAsync(input);
      router.replace(next);
    } catch (error) {
      setApiErrors(form.setError, error, ['name', 'nick', 'password']);
    }
  });

  return (
    <AuthCard
      title="Create account"
      description="Track your books, reading sessions and reading speed."
      footer={
        <>
          Already have an account?{' '}
          <AppLink href={`/sign-in${query}`} className={linkClass}>
            Sign in
          </AppLink>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <Field
          label="Name"
          autoComplete="name"
          autoFocus
          error={errors.name?.message}
          {...form.register('name')}
        />
        <Field
          label="Nick"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          helper="You sign in with it. Letters, numbers, dots and underscores."
          error={errors.nick?.message}
          {...form.register('nick')}
        />
        <Field
          label="Password"
          type="password"
          autoComplete="new-password"
          helper={`At least ${userLimits.passwordMin} characters.`}
          error={errors.password?.message}
          {...form.register('password')}
        />
        <RootError message={errors.root?.message} />
        <Button type="submit" disabled={isSubmitting} className="mt-1">
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthCard>
  );
}
