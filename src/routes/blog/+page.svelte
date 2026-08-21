<script lang="ts">
  import { BLOG_ARTICLES } from '$lib/blog'

  const article = BLOG_ARTICLES[0]
</script>

<svelte:head>
  <title>Blog | Advanced Digital Marketing LTDA</title>
  <meta name="description" content="Practical guides on search, AI visibility, paid media, and web engineering from Advanced Digital Marketing LTDA." />
  <link rel="canonical" href="https://advanceddigitalmarketingltda.com/blog/" />
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
      <a class="blog-card" href={`/blog/${article.slug}/`}>
        <div class="blog-card__meta">
          <span>Guide</span>
          <time datetime={article.published}>{article.published}</time>
        </div>
        <h2>{article.title}</h2>
        <p>{article.description}</p>
        <span class="blog-card__link">Read the guide <span aria-hidden="true">→</span></span>
      </a>
    </div>
  </div>
</section>
