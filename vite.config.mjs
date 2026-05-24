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
        target: "http://100.120.165.93:8090",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/qwen/, "/v1"),
      },
      "/api/customers": {
        target: "http://127.0.0.1:4174",
        changeOrigin: true,
      },
      "/api/review-items": {
        target: "http://127.0.0.1:4174",
        changeOrigin: true,
      },
      "/api/request-templates": {
        target: "http://127.0.0.1:4174",
        changeOrigin: true,
      },
      "/api/submission-requests": {
        target: "http://127.0.0.1:4174",
        changeOrigin: true,
      },
      "/api/document-types": {
        target: "http://127.0.0.1:4174",
        changeOrigin: true,
      },
      "/api/submission-portal": {
        target: "http://127.0.0.1:4174",
        changeOrigin: true,
      },
      "/api/submission-files": {
        target: "http://127.0.0.1:4174",
        changeOrigin: true,
      },
    },
  },
});
