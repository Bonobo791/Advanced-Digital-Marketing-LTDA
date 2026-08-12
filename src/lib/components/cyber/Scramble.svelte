<script lang="ts">
  import { onMount } from 'svelte'

  let {
    text,
    class: className = '',
  }: {
    text: string
    class?: string
  } = $props()

  const GLYPHS = '!<>-_/[]{}=+*^?#010101'

  // Display starts as the plain text; the animation writes into it.
  let display = $state(initialText())
  let frame = $state<number | null>(null)
  let reduced = $state(false)
  let el: HTMLSpanElement

  function initialText(): string {
    return text
  }

  onMount(() => {
    reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!reduced) {
      const io = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) {
            run()
            io.disconnect()
          }
        },
        { threshold: 0.8 },
      )
      io.observe(el)
      return () => {
        io.disconnect()
        if (frame !== null) cancelAnimationFrame(frame)
      }
    }
    return () => {
      if (frame !== null) cancelAnimationFrame(frame)
    }
  })

  function run() {
    if (reduced) return
    const start = performance.now()
    const duration = 320
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1)
      const settled = Math.floor(p * text.length)
      let out = text.slice(0, settled)
      for (let i = settled; i < text.length; i++) {
        out += text[i] === ' ' ? ' ' : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
      }
      display = out
      if (p < 1) frame = requestAnimationFrame(tick)
      else display = text
    }
    if (frame !== null) cancelAnimationFrame(frame)
    frame = requestAnimationFrame(tick)
  }
</script>

<span bind:this={el} class={className} onmouseenter={run} role="presentation">{display || text}</span>
