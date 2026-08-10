<script lang="ts">
  import { absoluteUrl, LOCALE_ROUTES, PAGE_META, type Locale, type PageId } from '$lib/locale'

  let { locale, page }: { locale: Locale; page: PageId } = $props()

  let metadata = $derived(PAGE_META[locale][page])
  let routes = $derived(LOCALE_ROUTES[page])
</script>

<svelte:head>
  <title>{metadata.title}</title>
  <meta name="description" content={metadata.description} />
  <link rel="canonical" href={absoluteUrl(routes[locale])} />
  <link rel="alternate" hreflang="en-US" href={absoluteUrl(routes['en-US'])} />
  <link rel="alternate" hreflang="pt-BR" href={absoluteUrl(routes['pt-BR'])} />
  <link rel="alternate" hreflang="x-default" href={absoluteUrl(routes['en-US'])} />
</svelte:head>
