<script lang="ts">
  let {
    char,
    class: className = '',
    onRed = false,
  }: {
    char: string
    class?: string
    onRed?: boolean
  } = $props()
</script>

<span class="kanji-bg {onRed ? 'kanji-on-red' : ''} {className}" aria-hidden="true">{char}</span>
