/**
 * sessionStorage access that never throws.
 *
 * Browsers can block storage entirely (private mode, strict policies), which
 * makes the raw `sessionStorage.getItem` / `setItem` calls throw a
 * SecurityError and abort component effects. These wrappers fail loudly and
 * recover: they log a warning and return a safe value so callers can keep a
 * visible in-memory state instead of breaking.
 */

export function getSessionItem(key: string): string | null {
  try {
    return sessionStorage.getItem(key)
  } catch {
    console.warn(`[session-storage] getItem("${key}") unavailable; storage is blocked`)
    return null
  }
}

/** Returns true when the value was persisted, false when storage is blocked. */
export function setSessionItem(key: string, value: string): boolean {
  try {
    sessionStorage.setItem(key, value)
    return true
  } catch {
    console.warn(`[session-storage] setItem("${key}") unavailable; value not persisted`)
    return false
  }
}
