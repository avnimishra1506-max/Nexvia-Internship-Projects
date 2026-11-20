/**
 * src/lib/auth.ts
 * ───────────────────────────────────────────────────────────
 * Authentication helpers — importable from BOTH server and
 * client components (no next/headers here).
 *
 * Functions that read cookies live in the API route itself.
 * ───────────────────────────────────────────────────────────
 */

import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

// ─── Constants ──────────────────────────────────────────────
const BCRYPT_ROUNDS = 12;
export const SESSION_COOKIE_NAME = "session_token";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days (seconds)

// ─── Password helpers ───────────────────────────────────────

/** Hash a plain-text password with bcrypt (12 rounds). */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/** Compare a plain-text password against a stored bcrypt hash. */
export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ─── Session DB helpers ─────────────────────────────────────

/**
 * Create a new Session row in the DB.
 * Returns the raw session token (to be set as a cookie).
 */
export async function createSession(userId: string): Promise<string> {
  const token = crypto.randomUUID() + "-" + crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000);

  await prisma.session.create({
    data: { token, userId, expiresAt },
  });

  return token;
}

/**
 * Validate a session token against the DB.
 * Returns the user record or null if invalid / expired.
 */
export async function validateSessionToken(token: string) {
  const session = await prisma.session.findUnique({
    where: { token },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
          createdAt: true,
        },
      },
    },
  });

  if (!session) return null;

  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { token } }).catch(() => {});
    return null;
  }

  return session.user;
}

/**
 * Delete a session from the DB (logout).
 */
export async function deleteSession(token: string): Promise<void> {
  try {
    await prisma.session.delete({ where: { token } });
  } catch {
    // Already gone — ignore
  }
}

// ─── Cookie string builders ─────────────────────────────────

/** Build a secure Set-Cookie header string. */
export function buildSessionCookie(token: string): string {
  const isProd = process.env.NODE_ENV === "production";
  const parts = [
    `${SESSION_COOKIE_NAME}=${token}`,
    "HttpOnly",
    "SameSite=Strict",
    "Path=/",
    `Max-Age=${SESSION_MAX_AGE}`,
  ];
  if (isProd) parts.push("Secure");
  return parts.join("; ");
}

/** Build a cookie header that clears the session. */
export function clearSessionCookie(): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`;
}

