import { Button } from '@/components/ui/button';

// Placeholder until milestone 4 builds the Library screen.
export default function LibraryPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-title font-bold">Library</h1>
      <p className="mt-2 text-muted">Your books will appear here.</p>
      <div className="mt-6 flex gap-3">
        <Button>Add book</Button>
        <Button variant="secondary">Log session</Button>
      </div>
    </main>
  );
}
