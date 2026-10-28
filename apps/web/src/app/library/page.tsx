import { Suspense } from 'react';
import { LibraryView } from './library-view';

export default function LibraryPage() {
  return (
    <Suspense>
      <LibraryView />
    </Suspense>
  );
}
