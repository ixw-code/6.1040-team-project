import { fileURLToPath } from "node:url";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

const backend = process.env.BACKEND_ORIGIN ?? `http://127.0.0.1:${process.env.PORT ?? "3000"}`;

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [vue()],
  server: {
    host: "localhost",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": backend,
      "/health": backend,
    },
  },
});
