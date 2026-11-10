import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * typescript-eslint records every `eslint.config.*` that touches `configs.recommended`.
 * Cursor lints the monorepo in one process, so api + mobile both get recorded. If
 * `parserOptions.tsconfigRootDir` is missing on the parser, that throws.
 * Stamp the root onto every recommended block, not only our later override.
 */
function withTsconfigRootDir(blocks, tsconfigRootDir) {
  return blocks.flatMap((block) => (Array.isArray(block) ? block : [block])).map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
    return {
      ...item,
      languageOptions: {
        ...item.languageOptions,
        parserOptions: {
          ...item.languageOptions?.parserOptions,
          tsconfigRootDir,
        },
      },
    };
  });
}

/**
 * Shared flat config. Apps must pass `tsconfigRootDir: import.meta.dirname`.
 * @param {{ ignores?: string[]; tsconfigRootDir: string }} options
 */
export function createConfig(options) {
  const tsconfigRootDir = options.tsconfigRootDir;
  if (!tsconfigRootDir) {
    throw new Error('createConfig() requires tsconfigRootDir: import.meta.dirname');
  }

  return tseslint.config(
    {
      ignores: [
        '**/node_modules/**',
        '**/dist/**',
        '**/.next/**',
        '**/.expo/**',
        '**/.turbo/**',
        '**/coverage/**',
        '**/next-env.d.ts',
        ...(options.ignores ?? []),
      ],
    },
    js.configs.recommended,
    ...withTsconfigRootDir(tseslint.configs.recommended, tsconfigRootDir),
    {
      languageOptions: {
        globals: { ...globals.node, ...globals.browser },
        parserOptions: { tsconfigRootDir },
      },
      rules: {
        '@typescript-eslint/no-unused-vars': [
          'error',
          { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
        ],
        '@typescript-eslint/consistent-type-imports': 'error',
      },
    },
    {
      files: ['**/*.{js,cjs}'],
      rules: { '@typescript-eslint/no-require-imports': 'off' },
    },
    prettier,
  );
}
