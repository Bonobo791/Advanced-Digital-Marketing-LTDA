<script lang="ts">
  import LocalizedHead from '$lib/components/chrome/LocalizedHead.svelte'
  import ContactVerifyPage from '$lib/components/pages/ContactVerifyPage.svelte'
  import type { ContactVerifyResult } from '$lib/server/contact'

  let { data }: { data: { verify: ContactVerifyResult } } = $props()
</script>

<LocalizedHead locale="en-US" page="contact" />
<ContactVerifyPage locale="en-US" verify={data.verify} />
