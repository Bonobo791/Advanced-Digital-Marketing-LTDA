<script lang="ts">
  import { onDestroy, setContext } from 'svelte'
  import type { Snippet } from 'svelte'
  import { SITE_MOTION, type SiteMotion } from '$lib/client/site-motion'

  let { children }: { children: Snippet } = $props()

  const state = $state<SiteMotion['state']>({ curtainReady: false, hero: 'waiting' })
  let revealTimer: number | undefined
  let revealFrame = 0

  const revealHero = (delay = 0) => {
    if (revealTimer) clearTimeout(revealTimer)
    if (revealFrame) cancelAnimationFrame(revealFrame)
    state.hero = 'waiting'

    const reveal = () => {
      revealFrame = requestAnimationFrame(() => {
        revealFrame = requestAnimationFrame(() => {
          state.hero = 'revealed'
          revealFrame = 0
        })
      })
    }

    revealTimer = delay ? window.setTimeout(reveal, delay) : undefined
    if (!delay) reveal()
  }

  const motion: SiteMotion = {
    state,
    registerHero: () => {
      state.hero = 'waiting'
      if (state.curtainReady) revealHero(60)
    },
    revealHero,
    completeCurtain: () => {
      state.curtainReady = true
    },
  }

  setContext(SITE_MOTION, motion)

  onDestroy(() => {
    if (revealTimer) clearTimeout(revealTimer)
    if (revealFrame) cancelAnimationFrame(revealFrame)
  })
</script>

{@render children()}
