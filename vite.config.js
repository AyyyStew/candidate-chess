import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import mdx from "@mdx-js/rollup";
import remarkGfm from "remark-gfm";

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [
    mdx({ remarkPlugins: [remarkGfm] }),
    react(),
    tailwindcss(),
    cloudflare(),
  ],
  test: { environment: "node" },
  optimizeDeps: {
    exclude: ["hono"],
  },
});
