<script lang="ts">
  import { onMount } from 'svelte'
  import type { Snippet } from 'svelte'

  let {
    delay = 0,
    y = 24,
    class: className = '',
    children,
  }: {
    delay?: number
    y?: number
    class?: string
    children: Snippet
  } = $props()

  let el: HTMLDivElement
  let inView = $state(false)

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
      { threshold: 0.3, rootMargin: '0px 0px 12% 0px' },
    )
    io.observe(el)

    const initialFrame = requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect()
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        inView = true
        io.disconnect()
      }
    })

    return () => {
      cancelAnimationFrame(initialFrame)
      io.disconnect()
    }
  })
</script>

<div bind:this={el} class="reveal-shell {className}">
  <div class="reveal" class:reveal-in={inView} style="--reveal-y: {y}px; transition-delay: {delay * 1000}ms">
    {@render children()}
  </div>
</div>
