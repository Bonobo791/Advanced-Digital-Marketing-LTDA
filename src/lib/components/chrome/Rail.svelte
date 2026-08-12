<script lang="ts">
  import { page } from '$app/state'
  import { JP } from '$lib/constants'
  import { PAGE_JP, pageForPath } from '$lib/locale'

  let pageId = $derived(pageForPath(page.url.pathname))
  let label = $derived(pageId ? PAGE_JP[pageId] : JP.brand)
</script>

<aside class="site-rail" aria-hidden="true"><span class="site-rail-mark"></span><span class="site-rail-label font-jp">{label}</span><span class="site-rail-seal font-jp-serif">{JP.seal}</span></aside>
