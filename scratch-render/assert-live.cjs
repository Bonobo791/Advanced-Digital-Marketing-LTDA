const { chromium } = require('playwright')
const path = '/home/user/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome'
const base = 'http://127.0.0.1:8373'
const failures = []
const ok = (name, cond) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name)
  if (!cond) failures.push(name)
}

;(async () => {
  const browser = await chromium.launch({ executablePath: path })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))

  // ---- homepage: 5 services everywhere ----
  await page.goto(base + '/', { waitUntil: 'load' })
  await page.waitForTimeout(1900)
  const home = await page.evaluate(() => ({
    hidx: [...document.querySelectorAll('.hero-mid .hidx .en')].map((e) => e.textContent.trim()),
    svcRows: [...document.querySelectorAll('.svc .svc-en b')].map((e) => e.textContent.trim()),
    svcButton: !!document.querySelector('.nav-svc-btn'),
  }))
  ok('home: hero index lists 5 services', JSON.stringify(home.hidx) === JSON.stringify(['Technical SEO', 'GEO', 'Web Development', 'Paid Search', 'Meta Ads']))
  ok('home: ledger has 5 rows incl. Meta Ads', JSON.stringify(home.svcRows) === JSON.stringify(['Technical SEO', 'GEO', 'Web Development', 'Paid Search', 'Meta Ads']))
  ok('home: nav has Services dropdown button', home.svcButton)
  await page.click('.nav-svc-btn')
  await page.waitForTimeout(450)
  const items = await page.evaluate(() => [...document.querySelectorAll('.svc-menu a')].map((a) => a.getAttribute('href')))
  ok('home: dropdown lists 5 service routes', JSON.stringify(items) === JSON.stringify(['/services/technical-seo/', '/services/geo/', '/services/web-development/', '/services/paid-search/', '/services/meta-ads/']))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(250)
  const closed = await page.evaluate(() => !document.querySelector('.nav-svc').classList.contains('open'))
  ok('home: Escape closes dropdown', closed)
  ok('home: #services anchor removed from nav links', !(await page.evaluate(() => [...document.querySelectorAll('.editorial-nav__links a')].some((a) => a.getAttribute('href') === '/#services'))))

  // ---- service page (en, technical-seo with 5 options) ----
  await page.goto(base + '/services/technical-seo/', { waitUntil: 'load' })
  await page.waitForTimeout(1900)
  const seo = await page.evaluate(() => ({
    title: document.title,
    h1: [...document.querySelectorAll('.hero-h1 .h-line')].map((e) => e.textContent.trim()).join(' '),
    opts: [...document.querySelectorAll('.opt-name')].map((e) => e.textContent.trim()),
    contact: document.querySelector('.contact h2.shear').textContent.trim(),
    kanji: document.querySelector('.hero .kanji.k-amb').textContent.trim(),
    canHref: document.querySelector('link[rel="canonical"]').getAttribute('href'),
  }))
  ok('seo page: title', seo.title === 'Advanced Digital Marketing LTDA | Technical SEO')
  ok('seo page: H1', seo.h1 === 'Technical SEO.')
  ok('seo page: 5 option cards', JSON.stringify(seo.opts) === JSON.stringify(['The Audit', 'Fix Sprint', 'Retainer', 'Content Development', 'Backlinks']))
  ok('seo page: contact headline', seo.contact === 'Stop losing customers to the answer box.')
  ok('seo page: hero kanji 技術', seo.kanji === '技術')
  ok('seo page: canonical en', seo.canHref === 'https://advanceddigitalmarketingltda.com/services/technical-seo/')
  await page.click('.nav-svc-btn')
  await page.waitForTimeout(400)
  const cur = await page.evaluate(() => document.querySelector('.svc-menu a[aria-current="page"]')?.getAttribute('href'))
  ok('seo page: dropdown marks current service', cur === '/services/technical-seo/')

  // ---- meta-ads page ----
  await page.goto(base + '/services/meta-ads/', { waitUntil: 'load' })
  await page.waitForTimeout(1600)
  const ma = await page.evaluate(() => ({
    h1: [...document.querySelectorAll('.hero-h1 .h-line')].map((e) => e.textContent.trim()).join(' '),
    opts: [...document.querySelectorAll('.opt-name')].map((e) => e.textContent.trim()),
    flag: document.querySelector('.opt-flag')?.textContent.trim(),
  }))
  ok('meta-ads: H1', ma.h1 === 'Reach that converts.')
  ok('meta-ads: 3 option cards', JSON.stringify(ma.opts) === JSON.stringify(['The Meta Audit', 'Meta Launch', 'Meta Retainer']))
  ok('meta-ads: rec flag shows once', ma.flag === 'Most chosen')

  // ---- pt-BR service page ----
  await page.goto(base + '/pt-br/servicos/geo/', { waitUntil: 'load' })
  await page.waitForTimeout(1600)
  const pt = await page.evaluate(() => ({
    h1: [...document.querySelectorAll('.hero-h1 .h-line')].map((e) => e.textContent.trim()).join(' '),
    opts: [...document.querySelectorAll('.opt-name')].map((e) => e.textContent.trim()),
    flag: document.querySelector('.opt-flag')?.textContent.trim(),
    navFirst: document.querySelector('.svc-menu a').getAttribute('href'),
    altPt: [...document.querySelectorAll('link[rel="alternate"]')].find((l) => l.getAttribute('hreflang') === 'pt-BR')?.getAttribute('href'),
  }))
  ok('pt geo: H1', pt.h1 === 'Seja a resposta.')
  ok('pt geo: option cards pt', JSON.stringify(pt.opts) === JSON.stringify(['Auditoria de Citações', 'Sprint de Citações', 'Mensal de Visibilidade']))
  ok('pt geo: flag localized', pt.flag === 'Mais escolhida')
  ok('pt geo: dropdown labels pt', pt.navFirst === '/pt-br/servicos/technical-seo/')
  ok('pt geo: hreflang pt', pt.altPt === 'https://advanceddigitalmarketingltda.com/pt-br/servicos/geo/')

  // ---- pt-BR homepage: 5 rows incl. Google Ads + Meta Ads ----
  await page.goto(base + '/pt-br/', { waitUntil: 'load' })
  await page.waitForTimeout(1600)
  const ptHome = await page.evaluate(() => [...document.querySelectorAll('.svc .svc-en b')].map((e) => e.textContent.trim()))
  ok('pt home: ledger 5 rows', JSON.stringify(ptHome) === JSON.stringify(['SEO técnico e local', 'GEO / visibilidade em respostas de IA', 'Sites e landing pages', 'Google Ads', 'Meta Ads']))

  // ---- subpage nav has dropdown too ----
  await page.goto(base + '/about/', { waitUntil: 'load' })
  await page.waitForTimeout(1600)
  const about = await page.evaluate(() => ({
    svcBtn: !!document.querySelector('.nav-svc-btn'),
    links: [...document.querySelectorAll('.editorial-nav__links a')].map((a) => a.textContent.trim()),
  }))
  ok('about: dropdown present on subpage', about.svcBtn)
  ok('about: page links intact', about.links.includes('Home') && about.links.includes('About'))

  // ---- mobile menu includes services ----
  const mob = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await mob.goto(base + '/', { waitUntil: 'load' })
  await mob.waitForTimeout(1500)
  await mob.click('.editorial-menu-button')
  await mob.waitForTimeout(400)
  const mobileItems = await mob.evaluate(() => [...document.querySelectorAll('.editorial-mobile-menu nav a')].map((a) => a.textContent.trim()))
  ok('mobile: menu includes all 5 services', ['Technical SEO', 'GEO', 'Web Development', 'Paid Search', 'Meta Ads'].every((s) => mobileItems.includes(s)))
  await mob.close()

  // ---- language switcher on service page maps en <-> pt ----
  await page.goto(base + '/services/web-development/', { waitUntil: 'load' })
  await page.waitForTimeout(1400)
  const ptLink = await page.evaluate(() => document.querySelector('.language-switcher a[hreflang="pt-BR"]')?.getAttribute('href'))
  ok('switcher: pt link maps to pt service page', ptLink === '/pt-br/servicos/web-development/')

  ok('no page errors', errors.length === 0)
  if (errors.length) console.log('PAGE ERRORS:', errors)
  console.log(failures.length === 0 ? 'ALL PASS' : failures.length + ' FAILURES')
  await browser.close()
  process.exit(failures.length === 0 ? 0 : 1)
})().catch((e) => {
  console.error('FATAL', e)
  process.exit(1)
})
