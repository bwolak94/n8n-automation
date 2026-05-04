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
    "!src/modules/marketplace/MarketplacePackage.model.ts",
    "!src/modules/marketplace/InstalledNode.model.ts",
    "!src/modules/marketplace/MarketplaceRepository.ts",
    "!src/modules/marketplace/IntegrationRepository.ts",
    "!src/modules/marketplace/IntegrationTemplate.model.ts",
    "!src/modules/collaboration/OpLog.model.ts",
    "!src/shared/types/express.d.ts",
    "!src/__tests__/**",
    "!src/scripts/**",
    // Pre-existing modules from prior tasks — covered by separate task test suites
    "!src/modules/analytics/**",
    "!src/modules/auth/**",
    "!src/modules/members/**",
    "!src/modules/queue/BullMQDLQRepository.ts",
    // Optional-driver implementations (mysql2, better-sqlite3) — tested via injected mocks in DatabaseNode.test.ts
    "!src/nodes/implementations/db/DatabaseClientFactory.ts",
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
