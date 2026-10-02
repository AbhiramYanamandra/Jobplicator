import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  base: "/static/",
  build: {
    outDir: "../app/static",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          auth: ["@supabase/supabase-js"],
          ui: [
            "@chakra-ui/react",
            "@emotion/react",
            "react",
            "react-dom",
            "next-themes",
          ],
        },
      },
    },
  },
  server: { proxy: { "/api": "http://127.0.0.1:8787" } },
  test: {},
});
