import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Forwards /api/* to the RailCast backend during development.
      // Start the backend first: cd server && node src/index.js
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
