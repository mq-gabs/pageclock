import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import baseConfig from '../../eslint.config.mjs';

const config = [
  ...baseConfig,
  ...nextVitals,
  ...nextTs,
  { ignores: ['.next/**', 'next-env.d.ts'] },
];

export default config;
