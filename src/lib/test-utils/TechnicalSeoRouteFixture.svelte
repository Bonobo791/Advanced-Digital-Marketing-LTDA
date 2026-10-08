<script lang="ts">
  import MotionProvider from '../components/chrome/MotionProvider.svelte'
  import CanonicalHead from '../components/chrome/CanonicalHead.svelte'
  import { page } from '$app/state'
  import ServiceRoute from '../../routes/services/[slug]/+page.svelte'
  import type { PageData } from '../../routes/services/[slug]/$types'

  let { data }: { data: PageData } = $props()
</script>

<CanonicalHead pathname={page.url.pathname} status={200} />

<MotionProvider>
  <ServiceRoute {data} form={null} params={{ slug: data.service }} />
</MotionProvider>
