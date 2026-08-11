<script lang="ts">
  import CheckoutPage from '$lib/components/pages/CheckoutPage.svelte'

  let { data } = $props()
</script>

<svelte:head>
  <title>Checkout | Advanced Digital Marketing LTDA</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<CheckoutPage locale="pt-BR" productSlug={data.productSlug} price={data.price} />
