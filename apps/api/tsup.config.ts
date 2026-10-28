import { readFileSync } from 'node:fs';
import { defineConfig } from 'tsup';

// tsup only reads ./package.json; the workspace has a single one at the root.
const rootPackage = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
) as { dependencies?: Record<string, string> };

export default defineConfig({
  entry: ['src/main.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node24',
  clean: true,
  outExtension: () => ({ js: '.js' }),
  // Bundle the shared source (a tsconfig path alias); keep npm deps external.
  external: Object.keys(rootPackage.dependencies ?? {}),
});
