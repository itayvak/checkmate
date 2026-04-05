import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
const apiProxy = {
  // Flask blueprints use `url_prefix="/api"`; forward `/api/*` unchanged to port 5000.
  "/api": {
    target: "http://localhost:5000",
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
