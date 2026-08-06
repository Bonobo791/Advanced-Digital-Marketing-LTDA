<script lang="ts">
  import { onMount } from 'svelte'

  export let delay = 0
  export let y = 24
  let className = ''
  export { className as class }

  let el: HTMLDivElement
  let inView = false

  onMount(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      inView = true
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          inView = true
          io.disconnect()
        }
      },
      { threshold: 0.3 },
    )
    io.observe(el)
    return () => io.disconnect()
  })
</script>

<div
  bind:this={el}
  class="reveal {className}"
  class:reveal-in={inView}
  style="--reveal-y: {y}px; transition-delay: {delay * 1000}ms"
>
  <slot />
</div>
