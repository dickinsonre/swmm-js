export default {
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  testMatch: ['**/tests/**/*.test.js'],
  moduleNameMapper: {
    '^lodash-es$': 'lodash',
  },
};
