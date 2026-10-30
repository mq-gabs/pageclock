import { Suspense } from 'react';
import type { Metadata } from 'next';
import { CreateAccountForm } from '@/components/auth-forms';

export const metadata: Metadata = { title: 'Create account' };

export default function CreateAccountPage() {
  return (
    <Suspense>
      <CreateAccountForm />
    </Suspense>
  );
}
