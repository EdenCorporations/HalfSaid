/**
 * Two Jest projects:
 *  - node: pure-TS package tests (incl. PGlite data-layer + retrieval/api).
 *  - web:  jsdom + Testing Library + jest-axe for the Conversation Canvas (SPEC §13).
 *
 * `npm test` runs both; `npm run test:a11y` runs only the web project.
 */
/** @type {import('jest').Config} */
module.exports = {
  projects: [
    {
      displayName: 'node',
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
    },
    {
      displayName: 'web',
      testEnvironment: 'jsdom',
      roots: ['<rootDir>/apps/web'],
      testMatch: ['**/*.test.tsx'],
      setupFilesAfterEnv: ['<rootDir>/apps/web/jest.setup.ts'],
      transform: {
        '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/apps/web/tsconfig.jest.json' }],
      },
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/apps/web/$1',
        '^@halfsaid/([^/]+)$': '<rootDir>/packages/$1/src',
      },
    },
  ],
  collectCoverageFrom: ['packages/*/src/**/*.ts', '!packages/*/src/**/*.d.ts'],
};
