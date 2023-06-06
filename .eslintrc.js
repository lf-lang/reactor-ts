module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'standard-with-typescript',
    'prettier',
  ],
  plugins: ['@typescript-eslint'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: ['./tsconfig.json']
  },
  ignorePatterns: ['.eslintrc.js', ],
  root: true,
  rules: {
    "@typescript-eslint/quotes": ["error", "double"],
    // This is to be addressed separately later
    "@typescript-eslint/no-this-alias": "off",
    // This two might cause redundant String() or .toString() calls
    "@typescript-eslint/restrict-template-expressions": "off",
    "@typescript-eslint/no-base-to-string": "off",
    "@typescript-eslint/naming-convention": [
      "warn",
      {
        selector: 'default',
        format: ['camelCase'],
        leadingUnderscore: 'allowSingleOrDouble',
        trailingUnderscore: 'allowSingleOrDouble',
      },
      {
        selector: 'variable',
        format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
        leadingUnderscore: 'allowSingleOrDouble',
        trailingUnderscore: 'allowSingleOrDouble',
      },
      {
        selector: 'typeLike',
        format: ['PascalCase'],
      },
      {
        selector: 'enumMember',
        format: ["camelCase", "UPPER_CASE"],
      }
    ],
  },
};
