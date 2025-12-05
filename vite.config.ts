import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync, rmSync, readdirSync, readFileSync, writeFileSync } from 'fs';

const __dirname = import.meta.dirname;

// Post-build plugin to fix paths and copy assets
const postBuild = () => ({
  name: 'post-build',
  closeBundle() {
    const distDir = resolve(__dirname, 'dist');

    // Move HTML files from src/ to correct locations and fix paths
    const srcDir = resolve(distDir, 'src');
    if (existsSync(srcDir)) {
      // Process sidepanel HTML
      const srcSidepanel = resolve(srcDir, 'sidepanel', 'index.html');
      const destSidepanel = resolve(distDir, 'sidepanel', 'index.html');
      if (existsSync(srcSidepanel)) {
        let html = readFileSync(srcSidepanel, 'utf-8');
        html = html.replace(/\.\.\/\.\.\/sidepanel\//g, './');
        html = html.replace(/\.\.\/\.\.\/assets\//g, '../assets/');
        html = html.replace(/\.\.\/\.\.\/chunks\//g, '../chunks/');
        writeFileSync(destSidepanel, html);
      }

      // Remove src directory
      rmSync(srcDir, { recursive: true, force: true });
    }

    // Copy manifest.json
    try {
      copyFileSync(
        resolve(__dirname, 'manifest.json'),
        resolve(distDir, 'manifest.json')
      );
    } catch {
      console.log('manifest.json copy failed or already exists');
    }

    // Copy icons from public to dist
    const publicIcons = resolve(__dirname, 'public', 'icons');
    const distIcons = resolve(distDir, 'icons');
    if (!existsSync(distIcons)) {
      mkdirSync(distIcons, { recursive: true });
    }
    if (existsSync(publicIcons)) {
      const iconFiles = readdirSync(publicIcons);
      iconFiles.forEach(file => {
        copyFileSync(resolve(publicIcons, file), resolve(distIcons, file));
      });
    }

    console.log('Post-build: Fixed paths and copied assets');
  },
});

export default defineConfig({
  plugins: [react(), postBuild()],
  publicDir: 'public',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@background': resolve(__dirname, 'src/background'),
      '@sidepanel': resolve(__dirname, 'src/sidepanel'),
      '@lib': resolve(__dirname, 'src/lib'),
      '@types': resolve(__dirname, 'src/types'),
      '@api': resolve(__dirname, 'src/api'),
    },
  },
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: process.env.NODE_ENV === 'development',
    minify: process.env.NODE_ENV === 'production',
    rollupOptions: {
      input: {
        sidepanel: resolve(__dirname, 'src/sidepanel/index.html'),
        'service-worker': resolve(__dirname, 'src/background/service-worker.ts'),
        'content-script': resolve(__dirname, 'src/content/content-script.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'service-worker') {
            return 'background/service-worker.js';
          }
          if (chunkInfo.name === 'content-script') {
            return 'content/content-script.js';
          }
          if (chunkInfo.name === 'sidepanel') {
            return 'sidepanel/sidepanel.js';
          }
          return '[name]/[name].js';
        },
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return 'assets/[name][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
  },
});
