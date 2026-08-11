<script lang="ts">
  /**
   * One-time website build pricing (user-defined spec).
   *
   * A single pricing line with two flippers:
   *  - build type: Website Development / Ecommerce Website Development
   *  - project kind: New website / Migration (migration costs 2×)
   *
   * The price is a one-time cost shown in the locale's currency (BRL on
   * pt-BR pages, USD on en-US pages). It is NOT part of the monthly
   * subscription configurator.
   */
  import {
    WEBSITE_BUILD_KINDS,
    WEBSITE_BUILD_TYPES,
    formatBuildPrice,
    websiteBuildPrice,
    type WebsiteBuildKind,
    type WebsiteBuildType,
  } from '$lib/website-builds'
  import type { Locale } from '$lib/locale'
  import { words } from '$lib/text'

  let { locale }: { locale: Locale } = $props()

  const copy = {
    'en-US': {
      kicker: 'Websites',
      heading: 'One-time website builds.',
      lead: 'A fixed price for a complete build. Choose the type, then whether we are migrating an existing site or building from scratch — migrations are priced at 2\u00D7.',
      typeLabel: 'Type',
      types: { website: 'Website', ecommerce: 'Ecommerce' },
      kindLabel: 'Project',
      kinds: { new: 'New website', migration: 'Migration' },
      names: { website: 'Website Development', ecommerce: 'Ecommerce Website Development' },
      oneTime: 'one-time',
      migrationNote: 'migration \u00B7 2\u00D7',
    },
    'pt-BR': {
      kicker: 'Sites',
      heading: 'Sites com preço fechado.',
      lead: 'Preço único para o build completo. Escolha o tipo e se é um site novo ou migração de um site existente — migrações custam 2\u00D7.',
      typeLabel: 'Tipo',
      types: { website: 'Site', ecommerce: 'E-commerce' },
      kindLabel: 'Projeto',
      kinds: { new: 'Site novo', migration: 'Migração' },
      names: { website: 'Desenvolvimento de Site', ecommerce: 'Desenvolvimento de Site E-commerce' },
      oneTime: 'pagamento único',
      migrationNote: 'migração \u00B7 2\u00D7',
    },
  } as const

  let text = $derived(copy[locale])
  let type = $state<WebsiteBuildType>('website')
  let kind = $state<WebsiteBuildKind>('new')
  let price = $derived(websiteBuildPrice(locale, type, kind))
</script>

<section class="paper-sec build-panel" id="builds">
  <div class="kanji ink-stroke" style="left:-6vw;bottom:-10%" aria-hidden="true">作</div>
  <div class="sec-inner">
    <span class="sec-jp rise">{text.kicker}<span class="font-jp">作</span></span>
    <h2 class="shear">{#each words(text.heading) as word, i}<span class="w">{word}{i < words(text.heading).length - 1 ? ' ' : ''}</span>{/each}</h2>
    <p class="sec-lead rise">{text.lead}</p>

    <div class="sub-row build-row">
      <div class="build-info">
        <b class="build-name">{text.names[type]}</b>
        <div class="build-flips">
          <div class="flip-group">
            <span class="flip-label">{text.typeLabel}</span>
            <div class="flip" role="group" aria-label={text.typeLabel}>
              {#each WEBSITE_BUILD_TYPES as t (t)}
                <button type="button" aria-pressed={type === t} onclick={() => (type = t)}>{text.types[t]}</button>
              {/each}
            </div>
          </div>
          <div class="flip-group">
            <span class="flip-label">{text.kindLabel}</span>
            <div class="flip" role="group" aria-label={text.kindLabel}>
              {#each WEBSITE_BUILD_KINDS as k (k)}
                <button type="button" aria-pressed={kind === k} onclick={() => (kind = k)}>{text.kinds[k]}</button>
              {/each}
            </div>
          </div>
        </div>
      </div>
      <div class="sub-price build-price" aria-live="polite">
        <b>{formatBuildPrice(locale, price)}</b>
        <small>{kind === 'migration' ? text.migrationNote : text.oneTime}</small>
      </div>
    </div>
  </div>
</section>
