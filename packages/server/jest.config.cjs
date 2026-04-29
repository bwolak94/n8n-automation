/** @type {import('jest').Config} */
const config = {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^@automation-hub/shared$": "<rootDir>/../shared/src/index.ts",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: "tsconfig.test.json",
      },
    ],
  },
  setupFiles: ["<rootDir>/src/__tests__/setup.env.ts"],
  testMatch: ["**/__tests__/**/*.test.ts"],
  coverageDirectory: "coverage",
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.test.ts",
    "!src/**/*.spec.ts",
    "!src/server.ts",
    "!src/config/env.ts",
    "!src/config/redis.ts",
    "!src/modules/tenants/TenantMember.model.ts",
    "!src/modules/workflows/Workflow.model.ts",
    "!src/shared/errors/ForbiddenError.ts",
    "!src/shared/types/express.d.ts",
    "!src/__tests__/**",
  ],
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
};

module.exports = config;
