import { defineConfig, loadEnv } from 'vite';

// In development, /api goes to nextjs-lobby, which keeps the app secret and
// signs room subscriptions, so the game and its backend share one origin.
// A hosted demo build (VITE_DEMO_API set) calls Hibira's demo backend instead.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    base: env.DEMO_BASE_PATH ? `${env.DEMO_BASE_PATH}/` : './',
    build: { chunkSizeWarningLimit: 2000 }, // Phaser alone is about 1.3 MB
    server: {
      proxy: { '/api': env.LOBBY_BACKEND || 'http://localhost:3000' },
    },
  };
});
