<script lang="ts">
  import { canonicalUrl } from '$lib/canonical-url'

  let { pathname, status }: { pathname: string; status: number } = $props()
  let url = $derived.by(() => {
    try {
      return canonicalUrl(pathname)
    } catch {
      return null
    }
  })
</script>

<svelte:head>
  {#if url && status >= 200 && status < 400}
    <link rel="canonical" href={url} />
    <meta property="og:url" content={url} />
  {/if}
</svelte:head>
