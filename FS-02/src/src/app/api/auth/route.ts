/**
 * src/app/api/auth/route.ts
 * ───────────────────────────────────────────────────────────
 * Authentication API — handles signup, login, logout, and
 * session validation via HTTP-only cookies.
 *
 * POST /api/auth  { action: "signup" | "login" | "logout" }
 * GET  /api/auth  → returns current session user or 401
 * ───────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  hashPassword,
  verifyPassword,
  createSession,
  validateSessionToken,
  deleteSession,
  buildSessionCookie,
  clearSessionCookie,
  SESSION_COOKIE_NAME,
} from "@/lib/auth";

// ─── GET — validate session and return user ──────────────────
export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const user = await validateSessionToken(token);
    if (!user) {
      const res = NextResponse.json({ error: "Session expired" }, { status: 401 });
      res.headers.set("Set-Cookie", clearSessionCookie());
      return res;
    }
    return NextResponse.json({ user });
  } catch (err) {
    console.error("[GET /api/auth] DB error:", err);
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }
}

// ─── POST — signup / login / logout ─────────────────────────
export async function POST(request: NextRequest) {
  let body: { action?: string; name?: string; email?: string; password?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { action, email, password, name } = body;

  // ── LOGOUT ───────────────────────────────────────────────
  if (action === "logout") {
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (token) await deleteSession(token);

    const res = NextResponse.json({ success: true });
    res.headers.set("Set-Cookie", clearSessionCookie());
    return res;
  }

  // ── Shared validation for signup / login ─────────────────
  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 }
    );
  }

  const normalizedEmail = email.toLowerCase().trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }

  // ── SIGNUP ───────────────────────────────────────────────
  if (action === "signup") {
    if (typeof name !== "string" || name.trim().length < 2) {
      return NextResponse.json(
        { error: "Name must be at least 2 characters" },
        { status: 400 }
      );
    }

    try {
      // Check if email already exists
      const existing = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });
      if (existing) {
        return NextResponse.json(
          { error: "An account with this email already exists" },
          { status: 409 }
        );
      }

      // Hash password and create user
      const hashedPassword = await hashPassword(password);
      const user = await prisma.user.create({
        data: {
          name: name.trim(),
          email: normalizedEmail,
          password: hashedPassword,
        },
        select: { id: true, name: true, email: true, avatar: true, createdAt: true },
      });

      // Create session and set cookie
      const token = await createSession(user.id);
      const res = NextResponse.json({ user }, { status: 201 });
      res.headers.set("Set-Cookie", buildSessionCookie(token));
      return res;
    } catch (err) {
      console.error("[POST /api/auth signup] Error:", err);
      if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
        return NextResponse.json(
          { error: "An account with this email already exists" },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
    }
  }

  // ── LOGIN ────────────────────────────────────────────────
  if (action === "login") {
    try {
      const user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });

      // Generic error prevents email enumeration attacks
      const INVALID_MSG = "Invalid email or password";

      if (!user || !user.password) {
        return NextResponse.json({ error: INVALID_MSG }, { status: 401 });
      }

      const passwordMatch = await verifyPassword(password, user.password);
      if (!passwordMatch) {
        return NextResponse.json({ error: INVALID_MSG }, { status: 401 });
      }

      // Create session
      const token = await createSession(user.id);
      const { password: _pw, ...safeUser } = user;

      const res = NextResponse.json({ user: safeUser });
      res.headers.set("Set-Cookie", buildSessionCookie(token));
      return res;
    } catch (err) {
      console.error("[POST /api/auth login] Error:", err);
      return NextResponse.json({ error: "Login failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
