import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { '@shared': resolve('src/shared') } },
    build: {
      rollupOptions: {
        input: {
          // The main process entry stays at out/main/index.js. The
          // whisper utility process gets its own entry so it can be
          // forked from a separate file path — see whisper-host.ts.
          index: resolve('src/main/index.ts'),
          'whisper-worker': resolve('src/main/whisper-worker.ts'),
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { '@shared': resolve('src/shared') } },
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/preload/index.ts'),
          indicator: resolve('src/preload/indicator.ts'),
          'paste-fallback': resolve('src/preload/paste-fallback.ts'),
        }
      }
    }
  },
  renderer: {
    resolve: { alias: { '@shared': resolve('src/shared') } },
    build: {
      rollupOptions: {
        input: {
          indicator: resolve('src/renderer/indicator/index.html'),
          settings: resolve('src/renderer/settings/index.html'),
          onboarding: resolve('src/renderer/onboarding/index.html'),
          'paste-fallback': resolve('src/renderer/paste-fallback/index.html')
        }
      }
    },
    plugins: [react()]
  }
})
