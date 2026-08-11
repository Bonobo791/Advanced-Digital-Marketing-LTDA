<script lang="ts">
  import ServicesIndexPage from '$lib/components/pages/ServicesIndexPage.svelte'
  import { absoluteUrl } from '$lib/locale'
</script>

<svelte:head>
  <title>Serviços | Advanced Digital Marketing LTDA</title>
  <meta
    name="description"
    content="SEO, GEO, mídia paga, web e automação com IA pela Advanced Digital Marketing — assine mensalmente a combinação que faz sentido para você, ou contrate por projeto."
  />
  <link rel="canonical" href={absoluteUrl('/pt-br/servicos/')} />
  <link rel="alternate" hreflang="en-US" href={absoluteUrl('/services/')} />
  <link rel="alternate" hreflang="pt-BR" href={absoluteUrl('/pt-br/servicos/')} />
  <link rel="alternate" hreflang="x-default" href={absoluteUrl('/services/')} />
</svelte:head>

<ServicesIndexPage locale="pt-BR" />
