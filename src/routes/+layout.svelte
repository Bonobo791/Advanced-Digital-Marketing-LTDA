<script lang="ts">
  import { onMount } from 'svelte'
  import '../app.css'
  import Curtain from '$lib/components/chrome/Curtain.svelte'
  import MotionProvider from '$lib/components/chrome/MotionProvider.svelte'
  import LanguageSuggestion from '$lib/components/chrome/LanguageSuggestion.svelte'
  import Nav from '$lib/components/chrome/Nav.svelte'
  import Rail from '$lib/components/chrome/Rail.svelte'
  import Footer from '$lib/components/chrome/Footer.svelte'
  import { captureAttribution } from '$lib/attribution'
  import type { Snippet } from 'svelte'

  let { children }: { children: Snippet } = $props()

  // First-touch marketing attribution (UTM / gclid / fbclid / landing page).
  // `motion-ready` is only added once Svelte has hydrated and this onMount
  // actually ran — a visitor with JS disabled/blocked never gets the class,
  // so `[data-hero-reveal]` elements stay visible instead of being hidden
  // forever by the motion CSS.
  onMount(() => {
    captureAttribution()
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.documentElement.classList.add('motion-ready')
    }
  })
</script>

<MotionProvider>
  <Curtain />
  <Nav />
  <Rail />
  <LanguageSuggestion />
  <main class="page-shell">
    {@render children()}
  </main>
  <Footer />
</MotionProvider>
