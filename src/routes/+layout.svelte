<script lang="ts">
  import '../app.css'
  import Boot from '$lib/components/cyber/Boot.svelte'
  import CrtOverlay from '$lib/components/cyber/CrtOverlay.svelte'
  import Nav from '$lib/components/chrome/Nav.svelte'
  import Footer from '$lib/components/chrome/Footer.svelte'
</script>

<Boot />
<CrtOverlay />
<Nav />
<main>
  <slot />
</main>
<Footer />
