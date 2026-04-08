import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
const apiProxy = {
  // Flask blueprints use `url_prefix="/api"`; forward `/api/*` unchanged to port 5000.
  // Use 127.0.0.1 (not "localhost") so Node does not resolve to IPv6 ::1 while Flask
  // listens on IPv4 — avoids ECONNREFUSED / 502 Bad Gateway on Windows.
  "/api": {
    target: "http://127.0.0.1:5000",
    changeOrigin: true,
  },
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: apiProxy,
  },
  preview: {
    port: 3000,
    proxy: apiProxy,
  },
})
