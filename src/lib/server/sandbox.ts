/**
 * Sandbox-mode detection for Mercado Pago credentials.
 *
 * Sandbox mode is detected by exact match: the configured access token must
 * equal `MERCADO_PAGO_SANDBOX_ACCESS_TOKEN` (set to the same value as
 * `MERCADO_PAGO_ACCESS_TOKEN` in the test environment). Anything else — an
 * unset sandbox variable or any other token — is treated as production.
 */
export function isSandboxAccessToken(
  accessToken: string | undefined,
  sandboxToken: string | undefined,
): boolean {
  // Empty strings are treated as unset — never a sandbox match.
  return !!accessToken && !!sandboxToken && accessToken === sandboxToken
}
