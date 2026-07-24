/**
 * Root Jest config. For Phase 1 this runs the pure-TypeScript package tests
 * (notably packages/safety-policy). Web-app + a11y tests arrive in later phases
 * via `npm run test:a11y` / Playwright.
 */
/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/packages'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.base.json' }],
  },
  moduleNameMapper: {
    '^@halfsaid/pcg/testing$': '<rootDir>/packages/pcg/src/testing/harness.ts',
    '^@halfsaid/([^/]+)$': '<rootDir>/packages/$1/src',
  },
  collectCoverageFrom: ['packages/*/src/**/*.ts', '!packages/*/src/**/*.d.ts'],
};
