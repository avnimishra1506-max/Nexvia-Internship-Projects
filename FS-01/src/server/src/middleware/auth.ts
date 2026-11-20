import type { NextFunction, Request, Response } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { createHash } from "node:crypto";
import { redis } from "../lib/redis";
import { hasAllowedRole } from "../domain/orderRules";

export type SessionUser = { id: string; name: string; email: string; role: "CUSTOMER" | "VENDOR" | "ADMIN" };
declare global {
  namespace Express {
    interface Request { auth?: SessionUser; accessToken?: string }
  }
}

const sessionKey = (token: string) => `session:${createHash("sha256").update(token).digest("hex")}`;

export function createSession(token: string, user: SessionUser, ttlSeconds: number) {
  return redis.set(sessionKey(token), JSON.stringify(user), "EX", ttlSeconds);
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ message: "Sign in to continue." });
  try {
    const claims = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    const session = await redis.get(sessionKey(token));
    if (!session) return res.status(401).json({ message: "Your session expired. Sign in again." });
    req.auth = JSON.parse(session) as SessionUser;
    req.accessToken = token;
    if (!claims.sub || claims.sub !== req.auth.id) return res.status(401).json({ message: "Invalid session." });
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired session." });
  }
}

export function allowRoles(...roles: SessionUser["role"][]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth || !hasAllowedRole(req.auth.role, roles)) return res.status(403).json({ message: "You do not have permission for this action." });
    return next();
  };
}

export const sessionCacheKey = sessionKey;
