<script lang="ts">
  import type { PageProps } from './$types'
  import LocalizedHead from '$lib/components/chrome/LocalizedHead.svelte'
  import ServicePage from '$lib/components/pages/ServicePage.svelte'
  import TechnicalSeoPage from '$lib/components/pages/TechnicalSeoPage.svelte'

  let { data }: PageProps = $props()
</script>

<LocalizedHead locale="en-US" service={data.service} />
{#if data.technicalSeo}
  <TechnicalSeoPage content={data.technicalSeo} />
{:else}
  <ServicePage locale="en-US" service={data.service} />
{/if}
