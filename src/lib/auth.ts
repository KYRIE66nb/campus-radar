import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, settings, type Settings, type User } from "@/db/schema";

const COOKIE_NAME = "cr_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 天

function secretKey(): Uint8Array {
  return new TextEncoder().encode(process.env.AUTH_SECRET || "dev-only-secret-change-me");
}

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10);
}

export async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}

export async function createSession(userId: number): Promise<void> {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secretKey());
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getSessionUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const uid = Number(payload.uid);
    if (!uid) return null;
    const rows = await db.select().from(users).where(eq(users.id, uid)).limit(1);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

/** 读取用户设置；不存在则创建默认行 */
export async function ensureSettings(userId: number): Promise<Settings> {
  const rows = await db.select().from(settings).where(eq(settings.userId, userId)).limit(1);
  if (rows[0]) return rows[0];
  const inserted = await db
    .insert(settings)
    .values({ userId, shareToken: randomBytes(12).toString("hex") })
    .onConflictDoNothing()
    .returning();
  if (inserted[0]) return inserted[0];
  const again = await db.select().from(settings).where(eq(settings.userId, userId)).limit(1);
  return again[0];
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** API 路由用：未登录抛 401 */
export async function requireUser(): Promise<User> {
  const u = await getSessionUser();
  if (!u) throw new HttpError(401, "请先登录");
  return u;
}
