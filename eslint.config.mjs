import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import reactHooks from "eslint-plugin-react-hooks";

// eslint-config-next 16 ships native flat configs (FlatCompat can no longer wrap it).
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: { "react-hooks": reactHooks },
    // React Compiler-era rules flag existing, working patterns (ref caches, effect-driven state). Kept visible as
    // warnings until each component is reworked on purpose; new code should not add more.
    rules: {
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/error-boundaries": "warn",
    },
  },
  { files: ["**/*.cjs"], rules: { "@typescript-eslint/no-require-imports": "off" } }, // Node CommonJS test fixtures
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "node_modules/**"]),
]);
