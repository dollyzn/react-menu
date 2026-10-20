import { configApp } from '@adonisjs/eslint-config'

export default configApp({
  name: 'React Menu contracts are type-only',
  rules: {
    '@typescript-eslint/no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: '@react-menu/contracts',
            allowTypeImports: true,
            message: 'Contracts are type-only: use `import type`.',
          },
        ],
      },
    ],
  },
})
