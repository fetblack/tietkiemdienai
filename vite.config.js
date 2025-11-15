// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Frontend gọi fetch("/api/hf-image") -> Vite proxy sang http://localhost:5174/api/hf-image
      "/api": {
        target: "http://localhost:5174",
        changeOrigin: true,
      },
    },
  },
});
