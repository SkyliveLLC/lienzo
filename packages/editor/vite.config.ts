import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

/** `vite` serves the pages in dev/. */
export default defineConfig({ root: 'dev', plugins: [vue()] });
