<script lang="ts">
  import LocalizedHead from '$lib/components/chrome/LocalizedHead.svelte'
  import PricingPage from '$lib/components/pages/PricingPage.svelte'

  let { data } = $props()
</script>

<LocalizedHead locale="pt-BR" page="pricing" />
<PricingPage locale="pt-BR" products={data.products} />
