/** @type {import('jest').Config} */
export default {
  clearMocks: true,
  collectCoverage: true,
  collectCoverageFrom: ["<rootDir>/src/**/*.js"],
  coverageDirectory: "<rootDir>/coverage",
  coverageReporters: ["text", "html"],
  testEnvironment: "node",
  testMatch: ["<rootDir>/test/**/*.test.js"],
  transform: {},
};
