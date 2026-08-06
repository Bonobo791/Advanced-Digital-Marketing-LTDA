<script lang="ts">
  import { onMount } from 'svelte'

  export let text: string
  let className = ''
  export { className as class }

  const GLYPHS = '!<>-_/[]{}=+*^?#010101'

  let display = text
  let frame: number | null = null
  let reduced = false

  onMount(() => {
    reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
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

<span class={className} onmouseenter={run}>{display}</span>
