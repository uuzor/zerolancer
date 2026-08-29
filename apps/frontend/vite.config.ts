import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@zerolance/config/abis": path.resolve(__dirname, "../../packages/config/src/abis/index.ts"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/v1": { target: "http://localhost:3000", changeOrigin: true },
      "/health": { target: "http://localhost:3000", changeOrigin: true },
      "/ws": {
        target: "ws://localhost:3000",
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-wagmi": ["wagmi", "@rainbow-me/rainbowkit", "viem"],
          "vendor-react": ["react", "react-dom", "react-router-dom"],
        },
      },
    },
  },
  define: {
    "process.env.ZERO_API_URL": JSON.stringify(
      process.env.ZERO_API_URL ?? "http://localhost:3000",
    ),
  },
});
