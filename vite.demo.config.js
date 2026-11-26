// npm run demo → la app con datos de ejemplo (sin Supabase). Solo para desarrollo.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const mock = fileURLToPath(new URL('./dev/mockSupabase.js', import.meta.url));

export default defineConfig({
  base: '/agenda-estudio/',
  plugins: [
    react(),
    {
      name: 'demo-supabase',
      enforce: 'pre',
      async resolveId(source, importer) {
        if (!importer || !/supabase\.js$/.test(source) || importer.includes('mockSupabase')) return null;
        const r = await this.resolve(source, importer, { skipSelf: true });
        return r && /[\\/]src[\\/]supabase\.js$/.test(r.id) ? mock : null;
      }
    }
  ],
  server: { port: 5174, strictPort: true }
});
