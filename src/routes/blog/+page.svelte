<script lang="ts">
  import { browser } from '$app/environment'
  import type { PageServerData } from './$types'

  let { data }: { data: PageServerData } = $props()

  // Blog articles are English-only: keep <html lang> in sync after client-side
  // navigation from a pt-BR page (mirrors LocalizedHead's effect).
  $effect(() => {
    if (browser) document.documentElement.lang = 'en-US'
  })
</script>

<svelte:head>
  <title>Blog | Advanced Digital Marketing LTDA</title>
  <meta name="description" content="Practical guides on search, AI visibility, paid media, and web engineering from Advanced Digital Marketing LTDA." />
</svelte:head>

<section class="blog-gateway">
  <div class="blog-gateway__inner">
    <header class="blog-gateway__header">
      <p class="section-label"><span class="font-jp">記事</span> Blog</p>
      <h1 class="blog-gateway__title">Ideas for the answer engines.</h1>
      <p class="blog-gateway__intro">
        Working notes on search, AI visibility, paid media, and the systems that turn attention into demand.
      </p>
    </header>

    <div class="blog-index-list">
      {#each data.articles as article (article.slug)}
        <a class="blog-card" href={`/blog/${article.slug}/`}>
          <div class="blog-card__meta">
            <span>Guide</span>
            <time datetime={article.published}>{article.published}</time>
          </div>
          <h2>{article.title}</h2>
          <p>{article.description}</p>
          <span class="blog-card__link">Read the guide <span aria-hidden="true">→</span></span>
        </a>
      {/each}
    </div>
  </div>
</section>
