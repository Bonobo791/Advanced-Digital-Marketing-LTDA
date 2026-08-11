<script lang="ts">
  import { absoluteUrl, LOCALE_ROUTES, PAGE_META, type Locale, type PageId } from '$lib/locale'
  import { SERVICE_META, SERVICE_ROUTES, type ServiceId } from '$lib/services'

  let { locale, page, service }: { locale: Locale; page?: PageId; service?: ServiceId } = $props()

  let metadata = $derived(service ? SERVICE_META[locale][service] : PAGE_META[locale][page!])
  let routes = $derived(service ? SERVICE_ROUTES[service] : LOCALE_ROUTES[page!])
</script>

<svelte:head>
  <title>{metadata.title}</title>
  <meta name="description" content={metadata.description} />
  <link rel="canonical" href={absoluteUrl(routes[locale])} />
  <link rel="alternate" hreflang="en-US" href={absoluteUrl(routes['en-US'])} />
  <link rel="alternate" hreflang="pt-BR" href={absoluteUrl(routes['pt-BR'])} />
  <link rel="alternate" hreflang="x-default" href={absoluteUrl(routes['en-US'])} />
</svelte:head>
