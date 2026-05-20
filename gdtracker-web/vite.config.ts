import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, repoRoot, '')
    const proxyTarget = env.VITE_DEV_PROXY_TARGET || 'http://localhost:8080'

    return {
        envDir: repoRoot,
        plugins: [
            react(),
            VitePWA({
                registerType: 'autoUpdate',
                manifest: {
                    name: 'GDTracker',
                    short_name: 'GDTracker',
                    description: 'Dashboard and planning for game development tracking.',
                    start_url: '/',
                    scope: '/',
                    display: 'standalone',
                    background_color: '#0b0b0f',
                    theme_color: '#478cbf',
                    icons: [
                        {
                            src: '/pwa-192.png',
                            sizes: '192x192',
                            type: 'image/png',
                            purpose: 'any',
                        },
                        {
                            src: '/pwa-512.png',
                            sizes: '512x512',
                            type: 'image/png',
                            purpose: 'any',
                        },
                        {
                            src: '/pwa-maskable-192.png',
                            sizes: '192x192',
                            type: 'image/png',
                            purpose: 'maskable',
                        },
                        {
                            src: '/pwa-maskable-512.png',
                            sizes: '512x512',
                            type: 'image/png',
                            purpose: 'maskable',
                        },
                    ],
                },
                workbox: {
                    navigateFallback: 'index.html',
                    navigateFallbackDenylist: [/^\/api/],
                    cleanupOutdatedCaches: true,
                    /*
                     * Online-first: no runtime caching for `/api/*` (see denylist above).
                     * For future offline/static caching, add `runtimeCaching` entries here
                     * only for idempotent URLs — never cache authenticated API JSON by accident.
                     */
                },
            }),
        ],
        resolve: {
            dedupe: ['@braintree/sanitize-url', 'mermaid'],
        },
        optimizeDeps: {
            include: ['@excalidraw/excalidraw'],
        },
        server: {
            proxy: {
                '/api': {
                    target: proxyTarget,
                    changeOrigin: true,
                },
            },
        },
    }
})
