<script lang="ts">
  import type { PageProps } from './$types'
  import LocalizedHead from '$lib/components/chrome/LocalizedHead.svelte'
  import ServicePage from '$lib/components/pages/ServicePage.svelte'
  import TechnicalSeoPage from '$lib/components/pages/TechnicalSeoPage.svelte'

  let { data }: PageProps = $props()
</script>

<LocalizedHead locale="pt-BR" service={data.service} />
{#if data.technicalSeo}
  <TechnicalSeoPage locale="pt-BR" content={data.technicalSeo} />
{:else}
  <ServicePage locale="pt-BR" service={data.service} />
{/if}
