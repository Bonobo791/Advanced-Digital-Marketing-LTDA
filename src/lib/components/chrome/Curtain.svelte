<script lang="ts">
  import { getContext, onMount } from 'svelte'
  import { SITE_MOTION, type SiteMotion } from '$lib/client/site-motion'

  const motion = getContext<SiteMotion>(SITE_MOTION)

  let show = $state(false)
  let lift = $state(false)

  onMount(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      motion.completeCurtain()
      motion.revealHero()
      return
    }

    if (sessionStorage.getItem('adm-curtain') === '1') {
      motion.completeCurtain()
      motion.revealHero(60)
      return
    }

    show = true
    document.body.classList.add('curtain-lock')

    const liftTimer = window.setTimeout(() => (lift = true), 300)
    const doneTimer = window.setTimeout(() => {
      show = false
      document.body.classList.remove('curtain-lock')
      sessionStorage.setItem('adm-curtain', '1')
    }, 800)
    const revealTimer = window.setTimeout(() => {
      motion.completeCurtain()
      motion.revealHero()
    }, 750)

    return () => {
      window.clearTimeout(liftTimer)
      window.clearTimeout(doneTimer)
      window.clearTimeout(revealTimer)
      document.body.classList.remove('curtain-lock')
    }
  })
</script>

{#if show}
  <div class="curtain" class:curtain-lift={lift} aria-hidden="true">
    <span class="curtain-seal font-jp-serif">答</span>
  </div>
{/if}
