/**
 * Minimum intersection ratio before an element counts as revealed. Used for
 * both the observer's `threshold` and the per-entry check, so an entry that
 * merely crossed the ratio boundary (or a stale entry from another observer)
 * can never reveal an element early.
 */
export const REVEAL_THRESHOLD = 0.12

/**
 * Shared scroll-reveal setup for `.index-home` pages (hero pages).
 *
 * All pages that render `[data-hero-reveal]` elements must call
 * `setupReveals()` from `onMount` (alongside `motion.registerHero()`), or the
 * hero stays invisible: `.motion-ready .index-home [data-hero-reveal]` hides
 * the elements until an ancestor receives `hero-revealed`.
 *
 * The IntersectionObserver fallback adds `io-on` to `.rise` / `.wipe` /
 * `.shear .w` elements when scroll-driven animations are unsupported.
 */
export function setupReveals(): () => void {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const supportsView = CSS.supports?.('animation-timeline: view()') ?? false

  const revealables = document.querySelectorAll<HTMLElement>(
    '.index-home .rise, .index-home .wipe, .index-home .shear .w, .index-home .why-img img, .index-home .p-portrait img',
  )

  let observer: IntersectionObserver | undefined
  if (!reduced && !supportsView && 'IntersectionObserver' in window) {
    document.documentElement.classList.add('index-io')
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= REVEAL_THRESHOLD) {
            entry.target.classList.add('io-on')
            observer?.unobserve(entry.target)
          }
        })
      },
      { threshold: REVEAL_THRESHOLD, rootMargin: '0px 0px -6% 0px' },
    )
    revealables.forEach((element) => observer?.observe(element))
  }

  return () => {
    observer?.disconnect()
    document.documentElement.classList.remove('index-io')
  }
}
