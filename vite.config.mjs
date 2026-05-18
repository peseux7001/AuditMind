import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss()],
  server: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
    proxy: {
      "/api/qwen": {
        target: "http://gx10-f0e1:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/qwen/, "/v1"),
      },
    },
  },
});
