export type HeroMotionPhase = 'waiting' | 'revealed'

export type SiteMotion = {
  state: {
    curtainReady: boolean
    hero: HeroMotionPhase
  }
  registerHero: () => void
  revealHero: (delay?: number) => void
  completeCurtain: () => void
}

export const SITE_MOTION = Symbol('site-motion')
