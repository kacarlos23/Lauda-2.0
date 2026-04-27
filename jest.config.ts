import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/src/__tests__/**/*.test.ts"],
  testTimeout: 120000,
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: "tsconfig.jest.json" }],
  },
  collectCoverageFrom: ["src/**/*.ts", "!src/server.ts", "!src/**/*.d.ts"],
};

export = config;
