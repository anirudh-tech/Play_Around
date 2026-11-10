import { createConfig } from '@playaround/config/eslint';

export default createConfig({
  ignores: ['expo-env.d.ts', 'dist/**'],
  tsconfigRootDir: import.meta.dirname,
});
