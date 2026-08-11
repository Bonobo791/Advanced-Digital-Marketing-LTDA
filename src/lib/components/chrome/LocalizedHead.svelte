<script lang="ts">
  import { browser } from '$app/environment'
  import {
    absoluteUrl,
    LOCALE_ROUTES,
    PAGE_META,
    SERVICES_INDEX_META,
    SERVICES_INDEX_ROUTES,
    type Locale,
    type PageId,
  } from '$lib/locale'
  import { SERVICE_META, SERVICE_ROUTES, type ServiceId } from '$lib/services'

  let {
    locale,
    page,
    service,
    servicesIndex = false,
  }: { locale: Locale; page?: PageId; service?: ServiceId; servicesIndex?: boolean } = $props()

  let metadata = $derived(
    servicesIndex
      ? SERVICES_INDEX_META[locale]
      : service
        ? SERVICE_META[locale][service]
        : PAGE_META[locale][page!],
  )
  let routes = $derived(
    servicesIndex ? SERVICES_INDEX_ROUTES : service ? SERVICE_ROUTES[service] : LOCALE_ROUTES[page!],
  )

  // In-app navigation reuses the outer <html> element, so the SSR lang
  // attribute must be kept in sync on the client (screen readers otherwise
  // keep pronouncing the previous locale).
  $effect(() => {
    if (!browser) return
    document.documentElement.lang = locale
  })
</script>

<svelte:head>
  <title>{metadata.title}</title>
  <meta name="description" content={metadata.description} />
  <link rel="canonical" href={absoluteUrl(routes[locale])} />
  <link rel="alternate" hreflang="en-US" href={absoluteUrl(routes['en-US'])} />
  <link rel="alternate" hreflang="pt-BR" href={absoluteUrl(routes['pt-BR'])} />
  <link rel="alternate" hreflang="x-default" href={absoluteUrl(routes['en-US'])} />
</svelte:head>
