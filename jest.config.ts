import type { Config } from 'jest';
import { createDefaultPreset } from 'ts-jest';

process.env.LOG_LEVEL = 'ERROR';

const tsJestTransformCfg = createDefaultPreset().transform;

const config: Config = {
  testEnvironment: 'node',

  transform: {
    ...tsJestTransformCfg,
  },

  testPathIgnorePatterns: ['/node_modules/', '/terraform/'],

  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/schema/**/*.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
};

export default config;
