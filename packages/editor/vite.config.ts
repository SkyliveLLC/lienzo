import vue from '@vitejs/plugin-vue';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { mockBackend } from './dev/mock/plugin.ts';

/**
 * `vite` serves the dev harness in dev/ with the mock backend.
 * `vite build` builds the library: the Vue component and the custom element,
 * with Vue and core left to the app's bundler.
 * `vite build --mode standalone` builds one file with everything inside, for
 * backends that have no JavaScript build of their own.
 */
export default defineConfig(({ command, mode }) => {
    if (command === 'serve') {
        return {
            root: 'dev',
            plugins: [vue(), mockBackend({ latency: Number(process.env.LIENZO_LATENCY ?? 60) })],
            server: { port: Number(process.env.PORT ?? 5174), strictPort: true },
        };
    }

    if (mode === 'standalone') {
        return {
            plugins: [vue()],
            define: { 'process.env.NODE_ENV': JSON.stringify('production') },
            build: {
                outDir: 'dist/standalone',
                emptyOutDir: true,
                // Library builds leave minifying to the app's bundler; this file is served as is.
                minify: true,
                rolldownOptions: { output: { minify: true } },
                sourcemap: true,
                lib: { entry: resolve(import.meta.dirname, 'src/element.ts'), formats: ['es'], fileName: () => 'lienzo-editor.js' },
            },
        };
    }

    return {
        plugins: [vue()],
        build: {
            outDir: 'dist',
            emptyOutDir: false,
            sourcemap: true,
            lib: { entry: { index: resolve(import.meta.dirname, 'src/index.ts'), element: resolve(import.meta.dirname, 'src/element.ts') }, formats: ['es'] },
            rolldownOptions: { external: [/^vue$/, /^@skylive\/lienzo-core(\/protocol)?$/, /^@lucide\/vue/] },
        },
    };
});
