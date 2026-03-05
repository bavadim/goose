import path from "node:path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: "dist-electron",
      sourcemap: true,
      emptyOutDir: false,
      rollupOptions: {
        input: "src/desktop/main/index.ts",
        output: {
          format: "es",
          entryFileNames: "main.js",
        },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: "dist-electron",
      sourcemap: true,
      emptyOutDir: false,
      rollupOptions: {
        input: "src/desktop/preload/index.ts",
        output: {
          format: "cjs",
          entryFileNames: "preload.cjs",
        },
      },
    },
  },
  renderer: {
    root: "src/desktop/renderer",
    base: "./",
    plugins: [tailwindcss()],
    build: {
      outDir: path.resolve(__dirname, "dist"),
      emptyOutDir: true,
      rollupOptions: {
        input: path.resolve(__dirname, "src/desktop/renderer/index.html"),
      },
    },
  },
});
