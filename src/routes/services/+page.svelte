<script lang="ts">
  import ServicesIndexPage from '$lib/components/pages/ServicesIndexPage.svelte'
  import { absoluteUrl } from '$lib/locale'
</script>

<svelte:head>
  <title>Services | Advanced Digital Marketing LTDA</title>
  <meta
    name="description"
    content="SEO, GEO, paid media, web and AI automation by Advanced Digital Marketing — subscribe monthly to the mix that fits, or engage per project."
  />
  <link rel="canonical" href={absoluteUrl('/services/')} />
  <link rel="alternate" hreflang="en-US" href={absoluteUrl('/services/')} />
  <link rel="alternate" hreflang="pt-BR" href={absoluteUrl('/pt-br/servicos/')} />
  <link rel="alternate" hreflang="x-default" href={absoluteUrl('/services/')} />
</svelte:head>

<ServicesIndexPage locale="en-US" />
