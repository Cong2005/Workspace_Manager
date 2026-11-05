
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

const getPath = (file: string) =>
  fileURLToPath(new URL(file, import.meta.url));

export default defineConfig({
  base: './',

  plugins: [
    react(),
    tailwindcss(),
  ],

  input: {
    popup: getPath('./popup.html'),
    sidepanel: getPath('./sidepanel.html'),
    newtab: getPath('./newtab.html'),
    background: getPath('./src/background/index.ts'),
  },

  build: {
    outDir: 'dist',
    emptyOutDir: true,

    rolldownOptions: {
      output: {
        entryFileNames: (chunk) => {
          if (chunk.name === 'background') {
            return 'background.js';
          }

          return 'assets/[name]-[hash].js';
        },

        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
