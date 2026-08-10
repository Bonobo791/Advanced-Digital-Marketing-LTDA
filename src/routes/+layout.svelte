<script lang="ts">
  import '../app.css'
  import Curtain from '$lib/components/chrome/Curtain.svelte'
  import MotionProvider from '$lib/components/chrome/MotionProvider.svelte'
  import LanguageSuggestion from '$lib/components/chrome/LanguageSuggestion.svelte'
  import Nav from '$lib/components/chrome/Nav.svelte'
  import Rail from '$lib/components/chrome/Rail.svelte'
  import Footer from '$lib/components/chrome/Footer.svelte'
  import type { Snippet } from 'svelte'

  let { children }: { children: Snippet } = $props()
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
