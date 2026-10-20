import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  globalIgnores([".next/**", ".next-e2e/**", "next-env.d.ts"]),
  {
    extends: [...nextCoreWebVitals, ...nextTypescript],
  },
  {
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@react-menu/contracts",
              allowTypeImports: true,
              message: "Contracts are type-only: use `import type`.",
            },
          ],
        },
      ],
    },
  },
]);
