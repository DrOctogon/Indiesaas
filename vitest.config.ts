import { resolve } from "node:path"
import { defineConfig } from "vitest/config"

/**
 * Vitest config. Mirrors the `@/*` → `src/*` path alias from tsconfig so unit
 * tests resolve internal engine imports the same way the app does. Tests are
 * pure (no DOM, no DB); the default node environment is correct.
 */
export default defineConfig({
    resolve: {
        alias: { "@": resolve(process.cwd(), "src") }
    },
    test: {
        include: ["src/**/*.test.ts"]
    }
})
