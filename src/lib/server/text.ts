/**
 * Shared server-side text validation/cleaning helpers.
 *
 * `containsControlCharacter` lives here (not in the submit route) because the
 * verification-token parser needs the same check for the optional subject
 * field — one definition, no copy-paste (AGENTS.md).
 */
/** True when the string contains any control character (log-forging / terminal escape injection). */
export function containsControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index)
    if (code <= 0x1f || code === 0x7f) return true
  }
  return false
}
