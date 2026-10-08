<script lang="ts">
  import { canonicalUrl } from '$lib/canonical-url'

  let { pathname, status }: { pathname: string; status: number } = $props()
  let url = $derived(canonicalUrl(pathname))
</script>

<svelte:head>
  {#if status >= 200 && status < 400}
    <link rel="canonical" href={url} />
    <meta property="og:url" content={url} />
  {/if}
</svelte:head>
