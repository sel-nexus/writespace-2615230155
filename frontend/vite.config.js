/** Configure the browser build and isolated DOM tests. */
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const port = Number(env.VITE_PORT || 5173);
  return {
    plugins: [react()],
    server: { host: '0.0.0.0', port, strictPort: true },
    preview: { host: '0.0.0.0', port, strictPort: true },
    test: {
      environment: 'jsdom',
      setupFiles: ['./tests/setup.js'],
      include: ['tests/**/*.test.{js,jsx}'],
      restoreMocks: true,
      pool: 'threads',
      poolOptions: { threads: { singleThread: true } },
      coverage: { provider: 'v8', include: ['src/**/*.{js,jsx}'], exclude: ['src/main.jsx'] },
    },
  };
});
