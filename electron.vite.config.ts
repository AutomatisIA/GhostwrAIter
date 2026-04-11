import { resolve } from "node:path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import { injectCspMetaTag, type CspMode } from "./app/build/csp";

function cspInjectionPlugin() {
  return {
    name: "linkedin-poster-csp-injection",
    transformIndexHtml: {
      order: "pre" as const,
      handler(html: string) {
        const mode: CspMode =
          process.env.NODE_ENV === "production" ? "production" : "development";
        return injectCspMetaTag(html, mode);
      }
    }
  };
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: "dist-electron/main",
      lib: {
        entry: resolve(__dirname, "app/main/index.ts")
      }
    },
    resolve: {
      alias: {
        "@shared": resolve(__dirname, "app/shared")
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: "dist-electron/preload",
      lib: {
        entry: resolve(__dirname, "app/preload/index.ts")
      }
    },
    resolve: {
      alias: {
        "@shared": resolve(__dirname, "app/shared")
      }
    }
  },
  renderer: {
    root: resolve(__dirname, "app/renderer"),
    plugins: [react(), cspInjectionPlugin()],
    build: {
      rollupOptions: {
        input: resolve(__dirname, "app/renderer/index.html")
      }
    },
    resolve: {
      alias: {
        "@": resolve(__dirname, "app/renderer/src"),
        "@shared": resolve(__dirname, "app/shared")
      }
    }
  }
});
