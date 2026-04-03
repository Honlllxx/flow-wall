import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // ✅ 【关键】必须添加这一行，将路径改为相对路径
  base: './', 
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  }
})