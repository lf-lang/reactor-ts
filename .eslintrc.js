module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'standard-with-typescript',
  ],
  plugins: ['@typescript-eslint'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json'
  },
  ignorePatterns: ['.eslintrc.js'],
  root: true,
  rules: {
    'semi': 'off',
    '@typescript-eslint/semi': ['error', 'always'],
    'no-extra-semi': 'off',
    "@typescript-eslint/no-extra-semi": "error",
  },
};
