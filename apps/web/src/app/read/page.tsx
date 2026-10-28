import type { Metadata } from 'next';
import { TimerView } from '@/components/timer-view';

export const metadata: Metadata = { title: 'Read' };

export default function ReadPage() {
  return <TimerView />;
}
