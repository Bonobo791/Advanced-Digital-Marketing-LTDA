<script lang="ts">
  import LocalizedHead from '$lib/components/chrome/LocalizedHead.svelte'
  import ServicePage from '$lib/components/pages/ServicePage.svelte'

  let { data } = $props()
</script>

<LocalizedHead locale="pt-BR" service={data.service} />
<ServicePage locale="pt-BR" service={data.service} />
