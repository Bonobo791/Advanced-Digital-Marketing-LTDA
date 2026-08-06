import adapter from '@sveltejs/adapter-static'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    // build straight into dist/ so static hosting picks it up
    adapter: adapter({ pages: 'dist', assets: 'dist', strict: true }),
  },
}

export default config
