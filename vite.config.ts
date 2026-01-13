
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // 允许在本地开发中使用 process.env.API_KEY
    // 它会优先读取环境变量中的 VITE_API_KEY
    'process.env.API_KEY': JSON.stringify(process.env.VITE_API_KEY || process.env.API_KEY)
  },
  server: {
    port: 3000,
    open: true
  }
});
