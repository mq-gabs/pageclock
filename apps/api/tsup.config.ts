import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/main.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node24',
  clean: true,
  // Bundle the workspace package (it ships TypeScript source); keep npm deps external.
  noExternal: ['@reading-tracker/shared'],
});
