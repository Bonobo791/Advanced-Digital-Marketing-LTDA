<script lang="ts">
  import { resolveOptionCtaHref, SERVICE_CONTENT, type ServiceId } from '$lib/services'
  import { getService, formatOptionPrice } from '$lib/catalog'
  import { LOCALE_ROUTES, type Locale } from '$lib/locale'
  import { words } from '$lib/text'

  let { locale, service }: { locale: Locale; service: ServiceId } = $props()
  let content = $derived(SERVICE_CONTENT[locale][service])
  let quoteOnly = $derived(getService(service)?.pricing.kind === 'quote')
  let contactRoute = $derived(LOCALE_ROUTES.contact[locale])
</script>

<section class="paper-sec" id="options"><div class="kanji ink-stroke" style="left:-6vw;bottom:-10%" aria-hidden="true">検索</div><div class="sec-inner"><span class="sec-jp rise">{content.optionsLabel}<span class="font-jp">サービス</span></span><h2 class="shear">{#each words(content.optionsHeading) as word, i}<span class="w">{word}{i < words(content.optionsHeading).length - 1 ? ' ' : ''}</span>{/each}</h2><p class="sec-lead rise">{content.optionsLead}</p><div class="opt-grid">{#if quoteOnly}<article class="opt opt--quote"><span class="opt-jp font-jp">{content.options[0].jp}</span><h3 class="opt-name">{content.options[0].name}</h3><p class="opt-price">{content.options[0].priceBRL !== null ? formatOptionPrice(locale, content.options[0].priceBRL) : content.options[0].priceLabel}</p><p class="opt-per">{content.options[0].per}</p><p class="opt-desc">{content.options[0].desc}</p><ul class="opt-list">{#each content.options[0].items as item (item)}<li>{item}</li>{/each}</ul><a class="btn btn-solid" href={resolveOptionCtaHref(content.options[0], content, contactRoute)}>{content.options[0].cta}</a></article>{:else}{#each content.options as option (option.name)}{@const ctaHref = resolveOptionCtaHref(option, content, contactRoute)}<article class="opt" class:rec={!!option.flag}>{#if option.flag}<span class="opt-flag">{option.flag}</span>{/if}<span class="opt-jp font-jp">{option.jp}</span><h3 class="opt-name">{option.name}</h3><p class="opt-price">{option.priceBRL !== null ? formatOptionPrice(locale, option.priceBRL) : option.priceLabel}</p><p class="opt-per">{option.per}</p><p class="opt-desc">{option.desc}</p><ul class="opt-list">{#each option.items as item (item)}<li>{item}</li>{/each}</ul><a class="btn {option.flag ? 'btn-solid' : 'btn-ghost-ink'}" href={ctaHref}>{option.cta}</a></article>{/each}{/if}</div><p class="opt-note rise"><b>{content.optionsNoteStrong}</b> {content.optionsNote}</p></div></section>
