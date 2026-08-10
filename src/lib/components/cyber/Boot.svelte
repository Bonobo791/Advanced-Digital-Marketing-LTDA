<script lang="ts">
  import { onMount } from 'svelte'

  const BLINDS = 12

  let phase = $state<'run' | 'out' | 'done'>('done')

  onMount(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (sessionStorage.getItem('adm-booted') === '1') return
    phase = 'run'
    const t1 = window.setTimeout(() => (phase = 'out'), 350)
    const t2 = window.setTimeout(() => {
      sessionStorage.setItem('adm-booted', '1')
      phase = 'done'
    }, 350 + BLINDS * 45 + 600)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  })
</script>

{#if phase !== 'done'}
  <div aria-hidden="true" class="pointer-events-none fixed inset-0 z-[80] flex">
    {#each Array(BLINDS) as _, i}
      <div
        class="boot-blind h-full flex-1 bg-[#151a20]"
        class:boot-out={phase === 'out'}
        style="transition-delay: {i * 45}ms"
      ></div>
    {/each}
  </div>
{/if}
