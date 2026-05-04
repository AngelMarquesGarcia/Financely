// @ts-check
import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  // Global ignores
  {
    ignores: ['dist/**', 'angular/.angular/**', '**/*.js', '**/*.mjs'],
  },

  // Electron + shared: TypeScript rules
  {
    files: ['electron/**/*.ts', 'shared/**/*.ts'],
    extends: [...tseslint.configs.recommended],
  },

  // Angular: TypeScript + Angular-specific rules
  {
    files: ['angular/src/**/*.ts'],
    extends: [...tseslint.configs.recommended, ...angular.configs.tsRecommended],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'app', style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'app', style: 'kebab-case' },
      ],
    },
  },

  // Angular: HTML template rules
  {
    files: ['angular/src/**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
  },

  // Prettier: disable conflicting formatting rules (always last)
  prettierConfig,
);
