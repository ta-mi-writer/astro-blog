// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';

// https://astro.build/config
export default defineConfig({
  integrations: [mdx()],
  server: {
    port: 3002,
    host: true,
  },
  vite: {
    server: {
      ws: {
        host: 'localhost', // ブラウザから見た接続先ホスト
        port: 3002,        // ブラウザから見た接続先ポート
      },
    },
  },
});
