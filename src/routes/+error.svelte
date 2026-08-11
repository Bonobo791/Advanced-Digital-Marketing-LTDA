<script lang="ts">
  import { page } from '$app/state'
</script>

<svelte:head>
  <title>{page.status} | Advanced Digital Marketing LTDA</title>
</svelte:head>

<h1>{page.status}</h1>
<p>{page.error?.message}</p>
