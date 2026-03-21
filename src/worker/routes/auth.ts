import { Hono, type Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { eq, and } from "drizzle-orm";
import { Google, Lichess, generateState, generateCodeVerifier } from "arctic";
import { users, oauthAccounts, sessions } from "../db/schema";
import type { AppBindings, AppVariables, AppDb } from "../context";

export const auth = new Hono<{
  Bindings: AppBindings;
  Variables: AppVariables;
}>();

function getOrigin(url: string) {
  return new URL(url).origin;
}

// ── Google ────────────────────────────────────────────────────────────────────

auth.get("/google", async (c) => {
  const google = new Google(
    c.env.GOOGLE_CLIENT_ID,
    c.env.GOOGLE_CLIENT_SECRET,
    `${getOrigin(c.req.url)}/api/v1/auth/google/callback`,
  );

  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const url = google.createAuthorizationURL(state, codeVerifier, [
    "openid",
    "email",
    "profile",
  ]);

  setCookie(c, "google_oauth_state", state, {
    httpOnly: true,
    sameSite: "Lax",
    maxAge: 600,
    path: "/",
  });
  setCookie(c, "google_code_verifier", codeVerifier, {
    httpOnly: true,
    sameSite: "Lax",
    maxAge: 600,
    path: "/",
  });

  return c.redirect(url.toString());
});

auth.get("/google/callback", async (c) => {
  const db = c.var.db;
  const google = new Google(
    c.env.GOOGLE_CLIENT_ID,
    c.env.GOOGLE_CLIENT_SECRET,
    `${getOrigin(c.req.url)}/api/v1/auth/google/callback`,
  );

  const storedState = getCookie(c, "google_oauth_state");
  const codeVerifier = getCookie(c, "google_code_verifier");
  const { code, state } = c.req.query();

  if (
    !storedState ||
    !state ||
    state !== storedState ||
    !code ||
    !codeVerifier
  ) {
    return c.json({ error: "Invalid state" }, 400);
  }

  const tokens = await google.validateAuthorizationCode(code, codeVerifier);
  const userInfo = await fetch(
    "https://openidconnect.googleapis.com/v1/userinfo",
    {
      headers: { Authorization: `Bearer ${tokens.accessToken()}` },
    },
  ).then((r) => r.json<{ sub: string; email: string; name: string }>());

  const token = await upsertUserAndCreateSession(
    db,
    "google",
    userInfo.sub,
    userInfo.email,
    userInfo.name,
  );

  deleteCookie(c, "google_oauth_state", { path: "/" });
  deleteCookie(c, "google_code_verifier", { path: "/" });
  setSessionCookie(c, token);

  return c.redirect("/");
});

// ── Lichess ───────────────────────────────────────────────────────────────────

auth.get("/lichess", async (c) => {
  const lichess = new Lichess(
    c.env.LICHESS_CLIENT_ID,
    `${getOrigin(c.req.url)}/api/v1/auth/lichess/callback`,
  );

  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const url = lichess.createAuthorizationURL(state, codeVerifier, []);

  setCookie(c, "lichess_oauth_state", state, {
    httpOnly: true,
    sameSite: "Lax",
    maxAge: 600,
    path: "/",
  });
  setCookie(c, "lichess_code_verifier", codeVerifier, {
    httpOnly: true,
    sameSite: "Lax",
    maxAge: 600,
    path: "/",
  });

  return c.redirect(url.toString());
});

auth.get("/lichess/callback", async (c) => {
  const db = c.var.db;
  const lichess = new Lichess(
    c.env.LICHESS_CLIENT_ID,
    `${getOrigin(c.req.url)}/api/v1/auth/lichess/callback`,
  );

  const storedState = getCookie(c, "lichess_oauth_state");
  const codeVerifier = getCookie(c, "lichess_code_verifier");
  const { code, state } = c.req.query();

  if (
    !storedState ||
    !state ||
    state !== storedState ||
    !code ||
    !codeVerifier
  ) {
    return c.json({ error: "Invalid state" }, 400);
  }

  const tokens = await lichess.validateAuthorizationCode(code, codeVerifier);
  const userInfo = await fetch("https://lichess.org/api/account", {
    headers: { Authorization: `Bearer ${tokens.accessToken()}` },
  }).then((r) => r.json<{ id: string; email?: string; username: string }>());

  const token = await upsertUserAndCreateSession(
    db,
    "lichess",
    userInfo.id,
    userInfo.email ?? `${userInfo.id}@lichess.org`,
    userInfo.username,
  );

  deleteCookie(c, "lichess_oauth_state", { path: "/" });
  deleteCookie(c, "lichess_code_verifier", { path: "/" });
  setSessionCookie(c, token);

  return c.redirect("/");
});

// ── Me ────────────────────────────────────────────────────────────────────────

auth.get("/me", (c) => {
  const user = c.var.user;
  if (!user) return c.json(null);
  return c.json({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    participationStreak: user.participationStreak,
    winStreak: user.winStreak,
  });
});

// ── Logout ────────────────────────────────────────────────────────────────────

auth.post("/logout", async (c) => {
  const db = c.var.db;
  const token = getCookie(c, "session");

  if (token) {
    await db.delete(sessions).where(eq(sessions.id, token));
  }

  deleteCookie(c, "session", { path: "/" });
  return c.json({ ok: true });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function setSessionCookie(
  c: Context<{ Bindings: AppBindings; Variables: AppVariables }>,
  token: string,
) {
  setCookie(c, "session", token, {
    httpOnly: true,
    sameSite: "Lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
}

async function upsertUserAndCreateSession(
  db: AppDb,
  provider: "google" | "lichess",
  providerUserId: string,
  email: string,
  displayName: string,
): Promise<string> {
  const existing = await db
    .select({ userId: oauthAccounts.userId })
    .from(oauthAccounts)
    .where(
      and(
        eq(oauthAccounts.provider, provider),
        eq(oauthAccounts.providerUserId, providerUserId),
      ),
    )
    .get();

  let userId: number;

  if (existing) {
    userId = existing.userId;
  } else {
    const newUser = await db
      .insert(users)
      .values({ email, displayName, createdAt: new Date() })
      .returning({ id: users.id })
      .get();

    userId = newUser!.id;

    await db.insert(oauthAccounts).values({ userId, provider, providerUserId });
  }

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
  await db.insert(sessions).values({ id: token, userId, expiresAt });

  return token;
}
