<script lang="ts">
  let { as = 'h2', text, class: className = '' }: { as?: 'h1' | 'h2'; text: string; class?: string } = $props()

  let words = $derived(text.trim().split(/\s+/).filter(Boolean))
</script>

<svelte:element this={as} class={`motion-heading ${className}`}>
  {#each words as word, index (word + index)}
    <span class="motion-heading__word">{word}</span>
  {/each}
</svelte:element>
