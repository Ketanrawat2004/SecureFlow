import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
// https://vitejs.dev/config/
export default defineConfig(function (_a) {
    var mode = _a.mode;
    // Load env so the proxy can also be configured via VITE_DEV_API_URL
    var env = loadEnv(mode, process.cwd(), '');
    var devApiTarget = env.VITE_DEV_API_URL || 'http://localhost:8000';
    return {
        plugins: [react()],
        resolve: {
            alias: {
                '@': path.resolve(__dirname, './src'),
            },
        },
        server: {
            port: 3000,
            proxy: {
                '/api': {
                    target: devApiTarget,
                    changeOrigin: true,
                },
            },
        },
        build: {
            outDir: 'dist',
            sourcemap: false,
            rollupOptions: {
                output: {
                    // Stable chunk names for long-lived caching
                    manualChunks: {
                        vendor: ['react', 'react-dom', 'react-router-dom'],
                        query: ['@tanstack/react-query'],
                    },
                },
            },
        },
    };
});
