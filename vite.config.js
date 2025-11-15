// vite.config.js
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// ⚠ Vite tự động load .env.development hoặc .env.production dựa trên mode
export default defineConfig(({ mode }) => {
  // Load các biến môi trường từ .env tương ứng
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],

    // ============================
    // 🔥 Dev server (npm run dev)
    // ============================
    server: {
      proxy: {
        "/api": {
          // Dev sẽ gọi localhost
          target: env.VITE_BACKEND_URL || "http://localhost:5174",
          changeOrigin: true,
          secure: false,
        },
      },
    },

    // ============================
    // 🔥 Build cho Android
    // ============================
    define: {
      "process.env": env, // đảm bảo inject biến môi trường đúng vào app
    },

    resolve: {
      alias: {
        "@": "/src",
      },
    },
  };
});
