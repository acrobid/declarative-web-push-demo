import { defineConfig } from "vite-plus";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  staged: { "*": "vp check --fix" },
  fmt: {},
  lint: { options: { typeAware: true, typeCheck: true } },
  server: {
    proxy: {
      "/api": "http://localhost:8787",
      "/t": "http://localhost:8787",
      "/healthz": "http://localhost:8787",
    },
  },
});
