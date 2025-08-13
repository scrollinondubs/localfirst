import { defineConfig } from 'vite';
import { resolve } from 'path';

// Get build target from environment
const BUILD_TARGET = process.env.BUILD_TARGET || 'content';

// Configuration for each build target
const configs = {
  content: {
    entry: resolve(__dirname, 'src/content-main.js'),
    fileName: 'content.js',
    name: 'LocalFirstContent'
  },
  background: {
    entry: resolve(__dirname, 'src/background/service-worker.js'),
    fileName: 'background/service-worker.js',
    name: 'LocalFirstBackground'
  },
  popup: {
    entry: resolve(__dirname, 'src/popup/popup.js'),
    fileName: 'popup/popup.js',
    name: 'LocalFirstPopup'
  }
};

const currentConfig = configs[BUILD_TARGET];

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false, // Don't empty since we build multiple times
    lib: {
      entry: currentConfig.entry,
      formats: ['iife'],
      name: currentConfig.name,
      fileName: () => currentConfig.fileName
    },
    rollupOptions: {
      output: {
        extend: true,
        globals: {
          chrome: 'chrome'
        }
      }
    },
    target: 'chrome89',
    minify: false,
    sourcemap: false
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
  },
});