import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Capacitor requires a relative base path for assets
  base: "./",
  build: {
    outDir: "dist",
  },
});
