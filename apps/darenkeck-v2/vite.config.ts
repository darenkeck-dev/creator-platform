import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const comboApiBaseUrl = env.VITE_COMBO_API_BASE_URL;

  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: comboApiBaseUrl
        ? {
            "/public": {
              target: comboApiBaseUrl,
              changeOrigin: true,
              secure: true,
            },
          }
        : undefined,
    },
  };
});
