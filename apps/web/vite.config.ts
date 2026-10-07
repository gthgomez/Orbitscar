import { defineConfig } from "vite";

const localAuthorityProxy = {
  "/api": {
    target: "http://127.0.0.1:4179",
    changeOrigin: false,
    rewrite: (path: string) => path.replace(/^\/api/, ""),
  },
};

export default defineConfig({
  server: { proxy: localAuthorityProxy },
  preview: { proxy: localAuthorityProxy },
});
