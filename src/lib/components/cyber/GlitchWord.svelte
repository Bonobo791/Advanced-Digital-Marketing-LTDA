<script lang="ts">
  let {
    text,
    class: className = '',
  }: {
    text: string
    class?: string
  } = $props()
</script>

<span class="glitch-word {className}" data-text={text}>{text}</span>
