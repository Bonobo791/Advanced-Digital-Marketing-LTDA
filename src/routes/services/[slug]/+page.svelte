<script lang="ts">
  import type { PageProps } from './$types'
  import LocalizedHead from '$lib/components/chrome/LocalizedHead.svelte'
  import ServicePage from '$lib/components/pages/ServicePage.svelte'

  let { data }: PageProps = $props()
</script>

<LocalizedHead locale="en-US" service={data.service} />
<ServicePage locale="en-US" service={data.service} />
