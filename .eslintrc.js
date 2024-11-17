module.exports = {
  'env': {
    'browser': true,
    'es2021': true
  },
  'extends': [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended'
  ],
  'overrides': [
    {
      'env': {
        'node': true
      },
      'files': [
        '.eslintrc.{js,cjs}'
      ],
      'parserOptions': {
        'sourceType': 'script'
      }
    }
  ],
  'parser': '@typescript-eslint/parser',
  'parserOptions': {
    'ecmaVersion': 'latest',
    'sourceType': 'module',
    'project': ['./tsconfig.json'],
  },
  'plugins': [
    '@typescript-eslint',
    'unused-imports'
  ],
  "ignorePatterns": [".eslint.js", "tsconfig.json", "webpack.config.js", "dist/**"],
  'rules': {
    '@typescript-eslint/dot-notation': 'error',
    '@typescript-eslint/indent': ['error', 2],
    '@typescript-eslint/no-empty-interface': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-floating-promises': 'off',
    '@typescript-eslint/no-misused-promises': 'off',
    'no-prototype-builtins': 'off',
    '@typescript-eslint/no-unsafe-assignment': 'off',
    '@typescript-eslint/no-unsafe-call': 'off',
    '@typescript-eslint/no-unsafe-member-access': 'off',
    '@typescript-eslint/no-unsafe-return': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/restrict-template-expressions': 'off',
    '@typescript-eslint/semi': 'warn',
    'dot-notation': 'off',
    indent: 'off',
    'jsx-quotes': ['error', 'prefer-single'],
    'linebreak-style': ['error', 'unix'],
    quotes: ['error', 'single'],
    semi: ['error', 'always'],
    'unused-imports/no-unused-imports': ['error'],
  }
};
