import { type Request, type Response, type NextFunction } from "express";

/**
 * DEV-ONLY trusted-principal seam (docs/auth-game-contract.md). When
 * DEV_PRINCIPAL=true, the auth contributor's middleware is simulated by
 * reading an explicit test identity header. Production replaces this file
 * with the real auth middleware; game logic below never changes.
 */
export interface RequestPrincipal {
  userId: string;
}

declare module "express-serve-static-core" {
  interface Request {
    principal?: RequestPrincipal;
  }
}

export function devPrincipalMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (process.env.DEV_PRINCIPAL !== "true") {
    res.status(401).json({ error: "authentication required" });
    return;
  }
  const userId = req.header("x-dev-user-id");
  if (!userId) {
    res.status(401).json({ error: "missing x-dev-user-id" });
    return;
  }
  req.principal = { userId };
  next();
}

export function requirePrincipal(req: Request): RequestPrincipal {
  if (!req.principal) throw new Error("missing principal (auth middleware)");
  return req.principal;
}
