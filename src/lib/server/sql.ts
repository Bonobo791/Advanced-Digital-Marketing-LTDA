/**
 * Narrow database-client surface used by the server data modules.
 *
 * libSQL's `Client` is assignable to this; tests pass a real in-memory libSQL
 * client. `args` values are limited to what the repository actually sends
 * (strings, numbers, null).
 */
export interface SqlDb {
  execute(options: {
    sql: string
    args?: Record<string, string | number | null>
  }): Promise<{
    rows?: ReadonlyArray<Record<string, unknown>>
    rowsAffected?: number
  }>
}
