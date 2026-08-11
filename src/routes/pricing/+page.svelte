<script lang="ts">
  import LocalizedHead from '$lib/components/chrome/LocalizedHead.svelte'
  import PricingPage from '$lib/components/pages/PricingPage.svelte'

  let { data } = $props()
</script>

<LocalizedHead locale="en-US" page="pricing" />
<PricingPage locale="en-US" products={data.products} />
