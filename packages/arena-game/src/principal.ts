/**
 * Auth seam (docs/auth-game-contract.md): game logic receives an already-trusted
 * principal from the auth layer's middleware/provider. The engine NEVER verifies
 * tokens and NEVER trusts identity fields from client action payloads — side and
 * membership always resolve server-side from this principal.
 */
export interface AuthenticatedPrincipal {
  userId: string;
  sessionId?: string;
}

/** Dev/test-only fixture. Production plugs the real auth middleware here. */
export function testPrincipal(userId: string, sessionId = `test-session-${userId}`): AuthenticatedPrincipal {
  return { userId, sessionId };
}
