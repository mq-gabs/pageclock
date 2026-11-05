'use client';

import { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { changePasswordSchema, signUpSchema, userLimits, type User } from '@reading-tracker/shared';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { backupErrorLines, backupFileName, importSummary } from '@/lib/backup';
import { setApiErrors } from '@/lib/form-errors';
import { setThemePreference, useThemePreference } from '@/lib/theme';
import type { ThemePreference } from '@/lib/theme-script';
import {
  fetchBackup,
  useChangePassword,
  useImportBackup,
  useMe,
  useSignOut,
  useUpdateProfile,
} from '@/lib/queries';
import { Field } from './field';
import { SegmentedControl } from './segmented-control';
import { Skeleton } from './skeletons';
import { ErrorState } from './states';

const card = 'flex flex-col gap-5 rounded-card border border-border bg-surface p-5 lg:p-6';

function SectionHeading({
  id,
  title,
  description,
}: {
  id: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <h2 id={id} className="text-[17px] font-semibold text-ink">
        {title}
      </h2>
      <p className="text-[14px] text-muted">{description}</p>
    </div>
  );
}

function FormStatus({ error, success }: { error?: string; success?: string | null }) {
  if (error) {
    return (
      <p role="alert" className="text-meta text-destructive">
        {error}
      </p>
    );
  }
  return (
    <p role="status" className="text-meta text-accent">
      {success}
    </p>
  );
}

/** Name and nick; the nick is checked for uniqueness by the API (409 → field error). */
const profileSchema = signUpSchema.pick({ name: true, nick: true });
type ProfileInput = z.input<typeof profileSchema>;
type ProfileOutput = z.output<typeof profileSchema>;

function ProfileForm({ user }: { user: User }) {
  const update = useUpdateProfile();
  const [saved, setSaved] = useState<string | null>(null);
  const form = useForm<ProfileInput, unknown, ProfileOutput>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user.name, nick: user.nick },
  });
  const { errors, isSubmitting, isDirty } = form.formState;

  const onSubmit = form.handleSubmit(async (input) => {
    setSaved(null);
    try {
      const { user: updated } = await update.mutateAsync(input);
      form.reset({ name: updated.name, nick: updated.nick });
      setSaved('Profile saved.');
    } catch (error) {
      setApiErrors(form.setError, error, ['name', 'nick']);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className={card} aria-labelledby="profile-heading">
      <SectionHeading
        id="profile-heading"
        title="Profile"
        description="Your name and the nick you sign in with."
      />
      <Field
        label="Name"
        autoComplete="name"
        error={errors.name?.message}
        {...form.register('name')}
      />
      <Field
        label="Nick"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        helper="Letters, numbers, dots and underscores. It must not be taken."
        error={errors.nick?.message}
        {...form.register('nick')}
      />
      <FormStatus error={errors.root?.message} success={saved} />
      <Button type="submit" className="self-start" disabled={isSubmitting || !isDirty}>
        {isSubmitting ? 'Saving…' : 'Save profile'}
      </Button>
    </form>
  );
}

const passwordFormSchema = changePasswordSchema
  .extend({ confirmPassword: z.string() })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'The passwords don’t match',
  });
type PasswordInput = z.input<typeof passwordFormSchema>;
type PasswordOutput = z.output<typeof passwordFormSchema>;

function PasswordForm({ nick }: { nick: string }) {
  const change = useChangePassword();
  const [saved, setSaved] = useState<string | null>(null);
  const form = useForm<PasswordInput, unknown, PasswordOutput>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async ({ currentPassword, newPassword }) => {
    setSaved(null);
    try {
      await change.mutateAsync({ currentPassword, newPassword });
      form.reset();
      setSaved('Password changed. Other devices were signed out.');
    } catch (error) {
      setApiErrors(form.setError, error, ['currentPassword', 'newPassword']);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className={card} aria-labelledby="password-heading">
      {/* Lets password managers tie the new password to the account. */}
      <input type="text" name="username" autoComplete="username" value={nick} hidden readOnly />
      <SectionHeading
        id="password-heading"
        title="Password"
        description="Enter your current password to choose a new one."
      />
      <Field
        label="Current password"
        type="password"
        autoComplete="current-password"
        error={errors.currentPassword?.message}
        {...form.register('currentPassword')}
      />
      <Field
        label="New password"
        type="password"
        autoComplete="new-password"
        helper={`At least ${userLimits.passwordMin} characters.`}
        error={errors.newPassword?.message}
        {...form.register('newPassword')}
      />
      <Field
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...form.register('confirmPassword')}
      />
      <FormStatus error={errors.root?.message} success={saved} />
      <Button type="submit" className="self-start" disabled={isSubmitting}>
        {isSubmitting ? 'Changing…' : 'Change password'}
      </Button>
    </form>
  );
}

function saveJsonFile(data: unknown, fileName: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

type BackupStatus = { kind: 'error'; lines: string[] } | { kind: 'success'; message: string };

/** Download the library as JSON, or merge a backup file into it. */
function BackupCard() {
  const importBackup = useImportBackup();
  const fileInput = useRef<HTMLInputElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [status, setStatus] = useState<BackupStatus | null>(null);

  const download = async () => {
    setStatus(null);
    setDownloading(true);
    try {
      saveJsonFile(await fetchBackup(), backupFileName(new Date()));
    } catch (error) {
      setStatus({ kind: 'error', lines: backupErrorLines(error) });
    } finally {
      setDownloading(false);
    }
  };

  const upload = async (file: File) => {
    setStatus(null);
    let data: unknown;
    try {
      data = JSON.parse(await file.text());
    } catch {
      setStatus({ kind: 'error', lines: [`${file.name} isn’t a valid JSON file.`] });
      return;
    }
    try {
      const result = await importBackup.mutateAsync(data);
      setStatus({ kind: 'success', message: importSummary(result) });
    } catch (error) {
      setStatus({ kind: 'error', lines: backupErrorLines(error) });
    }
  };

  return (
    <section className={card} aria-labelledby="backup-heading">
      <SectionHeading
        id="backup-heading"
        title="Backup"
        description="Download your books and reading sessions as a JSON file, or add the ones from a backup. Books and sessions you already have are skipped."
      />
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="secondary"
          disabled={downloading}
          onClick={() => void download()}
        >
          <Download aria-hidden />
          {downloading ? 'Preparing…' : 'Download backup'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={importBackup.isPending}
          onClick={() => fileInput.current?.click()}
        >
          <Upload aria-hidden />
          {importBackup.isPending ? 'Importing…' : 'Import backup'}
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          aria-label="Backup file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            // Clear it so choosing the same file again still fires a change.
            event.target.value = '';
            if (file) void upload(file);
          }}
        />
      </div>
      {status?.kind === 'error' ? (
        <div role="alert" className="flex flex-col gap-1 text-meta text-destructive">
          {status.lines.length > 1 && <p>The backup wasn’t imported:</p>}
          <ul className={status.lines.length > 1 ? 'list-disc pl-5' : undefined}>
            {status.lines.map((line, index) => (
              <li key={`${index}-${line}`}>{line}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p role="status" className="text-meta text-accent">
          {status?.message}
        </p>
      )}
    </section>
  );
}

const themeOptions: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

/** Light or dark colors, saved on this device. */
function AppearanceCard() {
  const theme = useThemePreference();
  return (
    <section className={card} aria-labelledby="appearance-heading">
      <SectionHeading
        id="appearance-heading"
        title="Appearance"
        description="Choose light or dark colors on this device. System follows your device setting."
      />
      <SegmentedControl
        label="Theme"
        options={themeOptions}
        value={theme}
        onChange={setThemePreference}
        className="self-start"
      />
    </section>
  );
}

function SignOutCard() {
  const signOut = useSignOut();
  return (
    <section className={card} aria-labelledby="sign-out-heading">
      <SectionHeading
        id="sign-out-heading"
        title="Sign out"
        description="Sign out of Pageclock on this device."
      />
      <Button
        type="button"
        variant="secondary"
        className="self-start"
        disabled={signOut.isPending}
        onClick={() => signOut.mutate()}
      >
        Sign out
      </Button>
    </section>
  );
}

function SettingsSkeleton() {
  return (
    <div role="status" aria-label="Loading settings" aria-busy className={card}>
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-32" />
    </div>
  );
}

export function SettingsView() {
  const { data: user, isPending, isError, error, refetch } = useMe();
  return (
    <main className="flex flex-col gap-4 px-5 pt-6 pb-5 lg:gap-6 lg:px-12 lg:py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-title-sm font-bold text-ink lg:text-title">Settings</h1>
        {user && (
          <p className="text-[14px] text-muted">
            Signed in as {user.name} (@{user.nick})
          </p>
        )}
      </header>
      <div className="flex max-w-140 flex-col gap-4 lg:gap-6">
        {isPending ? (
          <SettingsSkeleton />
        ) : isError ? (
          <ErrorState message={error.message} onRetry={() => void refetch()} />
        ) : (
          <>
            <ProfileForm key={user.id} user={user} />
            <PasswordForm nick={user.nick} />
            <BackupCard />
          </>
        )}
        <AppearanceCard />
        <SignOutCard />
      </div>
    </main>
  );
}
