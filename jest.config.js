module.exports = {
  collectCoverageFrom: [
    '<rootDir>/src/**/*.{ts,js}',
    '!<rootDir>/src/types/**/*',
    '!<rootDir>/node_modules/',
    '!<rootDir>/build/',
    '!<rootDir>/*.js',
  ],
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/test/tsconfig.json',
    },
  },
  preset: 'ts-jest',
  testEnvironment: 'node',
  testPathIgnorePatterns: ['<rootDir>/build/'],
};
