import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "dist-electron",
    emptyOutDir: false,
    sourcemap: true,
    lib: {
      entry: "src/server/index.ts",
      formats: ["es"],
      fileName: () => "server.js",
    },
    rollupOptions: {
      external: [/^node:/, "fastify", "@fastify/swagger"],
    },
  },
});
