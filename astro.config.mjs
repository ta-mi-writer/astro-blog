// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  integrations: [mdx()],
  server: {
    port: 3002,
    host: true,
  },
  vite: {
    plugins: [tailwindcss()],
    server: {
      ws: {
        host: "localhost", // ブラウザから見た接続先ホスト
        port: 3002, // ブラウザから見た接続先ポート
      },
    },
  },
});
