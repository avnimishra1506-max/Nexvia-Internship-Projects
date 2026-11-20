import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../db";
import { createSession, requireAuth, sessionCacheKey } from "../middleware/auth";
import { redis } from "../lib/redis";

const router = Router();

async function signIn(user: { id: string; name: string; email: string; role: "CUSTOMER" | "VENDOR" | "ADMIN" }) {
  const ttl = 60 * 60 * 12;
  const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET!, { expiresIn: ttl });
  await createSession(token, user, ttl);
  return { token, user };
}

const userFields = { id: true, name: true, email: true, role: true, vendorStatus: true, vendorName: true, phone: true, gender: true } as const;

router.post("/register", async (req, res) => {
  const name = String(req.body?.name || "").trim();
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  if (name.length < 2 || name.length > 100 || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) {
    return res.status(400).json({ message: "Provide a name, valid email, and password with at least 8 characters." });
  }
  try {
    const user = await prisma.user.create({
      data: { name, email, passwordHash: await bcrypt.hash(password, 12), role: "CUSTOMER" },
    select: userFields,
    });
    return res.status(201).json(await signIn(user));
  } catch (error: any) {
    if (error.code === "P2002") return res.status(409).json({ message: "An account with that email already exists." });
    throw error;
  }
});

router.post("/login", async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(String(req.body?.password || ""), user.passwordHash))) {
    return res.status(401).json({ message: "Email or password is incorrect." });
  }
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return res.json(await signIn(safeUser));
});

router.post("/logout", requireAuth, async (req, res) => {
  if (req.accessToken) await redis.del(sessionCacheKey(req.accessToken));
  return res.json({ message: "Signed out." });
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.auth!.id },
    select: userFields,
  });
  if (!user) return res.status(404).json({ message: "Account not found." });
  return res.json({ user });
});

router.put("/me", requireAuth, async (req, res) => {
  const name = String(req.body?.name || "").trim();
  const email = String(req.body?.email || "").trim().toLowerCase();
  const phone = String(req.body?.phone || "").trim();
  const gender = String(req.body?.gender || "").trim();
  if (name.length < 2 || name.length > 100 || !/^\S+@\S+\.\S+$/.test(email) || (phone && !/^\+?[0-9 ()-]{8,20}$/.test(phone)) || gender.length > 40) return res.status(400).json({ message: "Provide a valid name, email, phone number, and gender." });
  try {
    const user = await prisma.user.update({ where: { id: req.auth!.id }, data: { name, email, phone: phone || null, gender: gender || null }, select: userFields });
    return res.json({ user });
  } catch (error: any) {
    if (error.code === "P2002") return res.status(409).json({ message: "An account with that email already exists." });
    throw error;
  }
});

router.get("/me/notification-preferences", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.auth!.id }, select: { notificationPreferences: true } });
  return res.json({ preferences: user?.notificationPreferences || {} });
});

router.put("/me/notification-preferences", requireAuth, async (req, res) => {
  const preferences = req.body?.preferences;
  if (!preferences || typeof preferences !== "object" || Array.isArray(preferences)) return res.status(400).json({ message: "Provide notification preferences." });
  const user = await prisma.user.update({ where: { id: req.auth!.id }, data: { notificationPreferences: preferences }, select: { notificationPreferences: true } });
  return res.json({ preferences: user.notificationPreferences });
});

export default router;
