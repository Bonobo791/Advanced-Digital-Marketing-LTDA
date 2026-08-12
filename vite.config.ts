import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig, loadEnv } from 'vite'

// Load .env files into process.env so server-only modules (mercadoPago.ts,
// checkout.ts) see the values in Vite SSR dev mode — Vite only exposes them
// via import.meta.env otherwise. Production (Netlify) sets real OS env vars,
// so this is a no-op there. Never overwrites values already in process.env.
const env = loadEnv('development', process.cwd(), '')
for (const [key, value] of Object.entries(env)) {
  if (process.env[key] === undefined) {
    process.env[key] = value
  }
}

export default defineConfig({
  plugins: [sveltekit()],
})
