<script lang="ts">
  import { CHATGPT_ADS_ARTICLE } from '$lib/blog'

  const article = CHATGPT_ADS_ARTICLE
</script>

<svelte:head>
  <title>{article.metaTitle} | Advanced Digital Marketing LTDA</title>
  <meta name="description" content={article.description} />
  <link rel="canonical" href={`https://advanceddigitalmarketingltda.com/blog/${article.slug}/`} />
  <meta property="og:type" content="article" />
  <meta property="og:title" content={article.metaTitle} />
  <meta property="og:description" content={article.description} />
  <meta property="article:published_time" content={article.published} />
  <meta property="article:modified_time" content={article.updated} />
</svelte:head>

<article class="blog-article">
  <header class="blog-article__header">
    <a class="blog-article__back" href="/blog/">← Blog</a>
    <p class="section-label"><span class="font-jp">記事</span> Guide · {article.published}</p>
    <h1>{article.title}</h1>
    <p class="blog-article__dek">{article.description}</p>
  </header>

  <div class="blog-article__body">
    {@html article.html}
  </div>
</article>
