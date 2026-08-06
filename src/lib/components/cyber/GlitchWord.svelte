<script lang="ts">
  export let text: string
  let className = ''
  export { className as class }
</script>

<span class="glitch-word {className}" data-text={text}>{text}</span>
