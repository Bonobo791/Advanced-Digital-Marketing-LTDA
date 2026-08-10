<script lang="ts">
  import { onMount } from 'svelte'

  type Line = { prompt?: string; text: string }

  let {
    lines,
    title = 'adm.core',
    class: className = '',
  }: {
    lines: Line[]
    title?: string
    class?: string
  } = $props()

  let typed = $state<Line[]>([])
  let current = $state('')
  let lineIdx = $state(0)

  let done = $derived(lineIdx >= lines.length)
  let active = $derived(lines[lineIdx])

  onMount(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    typed = []
    current = ''
    lineIdx = 0
    if (reduced) {
      typed = lines
      lineIdx = lines.length
      return
    }
    const timers: number[] = []
    let li = 0
    let ci = 0
    const step = () => {
      const line = lines[li]
      if (!line) return
      const full = line.text
      ci++
      current = full.slice(0, ci)
      if (ci >= full.length) {
        typed = [...typed, line]
        current = ''
        li++
        ci = 0
        lineIdx = li
        timers.push(window.setTimeout(step, 260))
      } else {
        timers.push(window.setTimeout(step, 24))
      }
    }
    timers.push(window.setTimeout(step, 500))
    return () => {
      timers.forEach((t) => clearTimeout(t))
    }
  })
</script>

<div class="bracketed chamfer border border-white/10 bg-[#0c1526]/95 {className}">
  <span class="bk bk-tl"></span><span class="bk bk-tr"></span><span class="bk bk-bl"></span><span class="bk bk-br"></span>
  <div class="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
    <span class="h-1.5 w-1.5 bg-[#e83828]"></span>
    <span class="font-mono2 text-[11px] uppercase tracking-[0.22em] text-white/50">{title}</span>
  </div>
  <div class="px-4 py-4 font-mono2 text-[13px] leading-[1.9] text-white/80">
    {#each typed as l, i (i)}
      <div>
        {#if l?.prompt}<span class="text-[#e83828]">{l.prompt} </span>{/if}{l?.text}
      </div>
    {/each}
    {#if !done && active}
      <div>
        {#if active.prompt}<span class="text-[#e83828]">{active.prompt} </span>{/if}{current}<span
          class="cursor-block"
        ></span>
      </div>
    {/if}
    {#if done}
      <div>
        <span class="text-[#e83828]">&gt; </span><span class="cursor-block"></span>
      </div>
    {/if}
  </div>
</div>
