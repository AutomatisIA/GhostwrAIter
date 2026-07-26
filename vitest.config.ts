import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Test-time module resolution.
 *
 * The application resolves `@shared` and `@` through `electron.vite.config.ts`,
 * and TypeScript resolves them through the `paths` entries in the tsconfigs.
 * Vitest read neither, so until now the aliases only appeared in `import type`
 * statements, which are erased before anything runs: they were never actually
 * resolved, and the gap stayed invisible.
 *
 * The first runtime import through `@shared` therefore failed at test time on a
 * path that typechecks, lints and builds. This file closes that gap, and keeps
 * the aliases identical to the ones the application itself uses.
 *
 * Nothing else is configured on purpose. The test environment stays per-file
 * (`// @vitest-environment jsdom` where a DOM is needed), exactly as before.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@shared": resolve(__dirname, "app/shared"),
      "@": resolve(__dirname, "app/renderer/src")
    }
  }
});
