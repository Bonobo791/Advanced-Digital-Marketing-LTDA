<script lang="ts">
  import { EMAIL, JP, LINKS, MAILTO } from '$lib/constants'
  import logoMark from '$lib/assets/adm-logo-mark.png'
</script>

<footer class="border-t border-white/10 bg-[#151a20]">
  <div class="mx-auto grid max-w-[1400px] gap-12 px-6 py-16 md:grid-cols-12 md:px-12">
    <div class="md:col-span-5">
      <p class="flex items-center gap-3 font-mono2 text-sm font-bold tracking-[0.18em] text-[#eef2ef]">
        <img src={logoMark} alt="" class="h-6 w-6" width="1560" height="1560" />
        ADM<span class="text-[#e66757]">//</span>LTDA
      </p>
      <p class="mt-4 max-w-[40ch] text-sm leading-relaxed text-white/50">
        Advanced Digital Marketing LTDA. Search, paid media, and web design for companies that need to be found by
        people and machines alike.
      </p>
      <p class="mt-6 font-mono2 text-[12px] text-white/40">
        <span class="text-[#e66757]">&gt; </span>status: connection stable<span class="cursor-block"></span>
      </p>
    </div>
    <div class="md:col-span-3">
      <p class="mono-label text-white/40">Navigate <span class="font-jp ml-2 normal-case tracking-normal text-white/25">{JP.navigate}</span></p>
      <ul class="mt-4 space-y-3 text-sm">
        {#each LINKS as l (l.to)}
          <li>
            <a href={l.to} class="text-white/60 hover:text-[#76d7dd]">{l.label}</a>
          </li>
        {/each}
      </ul>
    </div>
    <div class="md:col-span-4">
      <p class="mono-label text-white/40">Registered office <span class="font-jp ml-2 normal-case tracking-normal text-white/25">{JP.office}</span></p>
      <address class="mt-4 font-mono2 text-[13px] not-italic leading-[1.9] text-white/60">
        AV PAULISTA 777<br />
        ANDAR 15 CONJ 15 SALA 3408<br />
        SAO PAULO, SP<br />
        01311-914
      </address>
      <a href={MAILTO} class="mt-4 inline-block break-all font-mono2 text-[13px] text-[#76d7dd] hover:text-[#a4eef0]">
        {EMAIL}
      </a>
    </div>
  </div>
  <div class="border-t border-white/10">
    <div class="mx-auto flex max-w-[1400px] flex-col gap-2 px-6 py-6 font-mono2 text-[11px] uppercase tracking-[0.18em] text-white/30 md:flex-row md:items-center md:justify-between md:px-12">
      <span>Advanced Digital Marketing LTDA</span>
      <span>Sao Paulo, Brazil</span>
    </div>
  </div>
</footer>
