<script lang="ts">
  import { getContext, onMount } from 'svelte'
  import type { PageProps } from './$types'
  import { SITE_MOTION, type SiteMotion } from '$lib/client/site-motion'
  import { setupReveals } from '$lib/client/reveal'
  import { firePurchase } from '$lib/client/analytics'
  import { getSessionItem, setSessionItem } from '$lib/client/session-storage'
  import { LOCALE_ROUTES } from '$lib/locale'

  const motion = getContext<SiteMotion>(SITE_MOTION)

  let { data }: PageProps = $props()

  onMount(() => {
    motion.registerHero()
    return setupReveals()
  })

  const headline = $derived(
    data.state === 'confirmed'
      ? 'Your payment was approved.'
      : data.state === 'payment_pending'
        ? 'Your payment is being processed.'
        : data.state === 'payment_unconfirmed'
          ? 'Your payment was not confirmed.'
          : data.state === 'rate_limited'
            ? 'Your payment could not be confirmed right now.'
            : 'Your payment could not be confirmed.',
  )

  const subtext = $derived(
    data.state === 'confirmed'
      ? 'Your payment was approved by Stripe. We will start your project — you will receive the next steps by email.'
      : data.state === 'payment_pending'
        ? 'Your payment is being processed by Stripe. As soon as the confirmation arrives, we will start your project — you will receive the next steps by email.'
        : data.state === 'payment_unconfirmed'
          ? 'Your payment was not confirmed by Stripe. If you tried to pay and were redirected here, please try again or contact us.'
          : data.state === 'rate_limited'
            ? 'Too many verification attempts from your connection. Please wait a few minutes and refresh.'
            : 'We could not confirm your payment. Please try again or contact us.',
  )

  // Purchase conversion: fired only when the SERVER verified the session is
  // paid (data.state === 'confirmed'), and only once per session id
  // (sessionStorage dedupe) so a refresh or revisit cannot double-count.
  $effect(() => {
    if (data.state !== 'confirmed') return
    const sessionId = data.sessionId
    const key = 'adm-stripe-purchase-fired'
    const raw = getSessionItem(key)
    let fired: Record<string, boolean> = {}
    try {
      fired = raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
    } catch {
      // Corrupt storage value: ignore and overwrite with a fresh record.
    }
    if (fired[sessionId]) return
    firePurchase({
      orderId: data.clientReferenceId ?? sessionId,
      value: data.amountTotal ?? 0,
      currency: 'USD',
      items: [],
    })
    setSessionItem(key, JSON.stringify({ ...fired, [sessionId]: true }))
  })
</script>

<svelte:head><title>Payment result | Advanced Digital Marketing LTDA</title><meta name="robots" content="noindex" /></svelte:head>

<section class="paper-sec">
  <div class="kanji ink-stroke" style="left:-6vw;bottom:-10%" aria-hidden="true">完了</div>
  <div class="sec-inner">
    <span class="sec-jp rise">Payment<span class="font-jp">支払い</span></span>
    <h2 class="shear">{headline}</h2>
    <p class="sec-lead rise">{subtext}</p>
    <div class="proc-cta rise">
      <a class="btn btn-solid" href={LOCALE_ROUTES.home['en-US']}>Back to home</a>
      <a class="btn btn-ghost-ink" href={LOCALE_ROUTES.contact['en-US']}>Contact us</a>
    </div>
  </div>
</section>
