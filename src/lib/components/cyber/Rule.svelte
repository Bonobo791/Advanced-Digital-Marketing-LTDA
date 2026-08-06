<script lang="ts">
  import { onMount } from 'svelte'

  let { class: className = '' }: { class?: string } = $props()

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
      { threshold: 0.6 },
    )
    io.observe(el)
    return () => io.disconnect()
  })
</script>

<div aria-hidden="true" class="h-px w-full bg-white/10 {className}">
  <div bind:this={el} class="rule-line h-px w-full bg-[#00e5ff]/40" class:rule-in={inView}></div>
</div>
