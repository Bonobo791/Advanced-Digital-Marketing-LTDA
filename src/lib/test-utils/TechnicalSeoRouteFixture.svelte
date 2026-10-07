<script lang="ts">
  import MotionProvider from '../components/chrome/MotionProvider.svelte'
  import ServiceRoute from '../../routes/services/[slug]/+page.svelte'
  import type { PageData } from '../../routes/services/[slug]/$types'

  let { data }: { data: PageData } = $props()
</script>

<MotionProvider>
  <ServiceRoute {data} form={null} params={{ slug: data.service }} />
</MotionProvider>
