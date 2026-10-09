<script lang="ts">
  import MotionProvider from '../components/chrome/MotionProvider.svelte'
  import CanonicalHead from '../components/chrome/CanonicalHead.svelte'
  import { page } from '$app/state'
  import ServiceRoute from '../../routes/services/[slug]/+page.svelte'
  import PortugueseServiceRoute from '../../routes/pt-br/servicos/[slug]/+page.svelte'
  import type { PageData } from '../../routes/services/[slug]/$types'
  import type { PageData as PortuguesePageData } from '../../routes/pt-br/servicos/[slug]/$types'
  import type { Locale } from '../locale'

  let { data, locale = 'en-US' }: { data: PageData | PortuguesePageData; locale?: Locale } = $props()
</script>

<CanonicalHead pathname={page.url.pathname} status={200} />

<MotionProvider>
  {#if locale === 'pt-BR'}
    <PortugueseServiceRoute data={data as PortuguesePageData} form={null} params={{ slug: data.service }} />
  {:else}
    <ServiceRoute data={data as PageData} form={null} params={{ slug: data.service }} />
  {/if}
</MotionProvider>
