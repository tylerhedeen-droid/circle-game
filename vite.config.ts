import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify('1.4.3') },
  base: './',
  plugins: [react(), VitePWA({
    registerType: 'prompt',
    workbox: { cleanupOutdatedCaches: true, clientsClaim: true, skipWaiting: false },
    manifest: {
      name: 'Circle — The Roundness Game', short_name: 'Circle', description: 'Draw a circle. Defend your honor.',
      theme_color: '#f4ff61', background_color: '#151515', display: 'standalone', orientation: 'portrait-primary',
      icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }]
    }
  })]
})
