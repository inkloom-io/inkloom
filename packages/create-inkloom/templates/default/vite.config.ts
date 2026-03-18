import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "web-worker": path.resolve(__dirname, "src/stubs/web-worker.ts"),
    },
  },
  build: {
    outDir: "dist",
    assetsDir: "assets",
  },
});
