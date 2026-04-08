const BASE = "/api/v1";

// ── Puzzle Turnstile ──────────────────────────────────────────────────────────

let puzzleWidgetId: string | null = null;
let puzzleToken: string | null = null;
let puzzleTokenResolve: ((token: string | null) => void) | null = null;
let puzzleInitResolve: (() => void) | null = null;
const puzzleInitPromise = new Promise<void>((resolve) => {
  puzzleInitResolve = resolve;
});

export function initPuzzleTurnstile(sitekey: string) {
  console.log("[turnstile] initPuzzleTurnstile called", {
    hasTurnstile: !!window.turnstile,
    alreadyInit: puzzleWidgetId !== null,
  });
  if (puzzleWidgetId !== null || !window.turnstile) return;
  puzzleWidgetId = window.turnstile.render("#puzzle-turnstile-widget", {
    sitekey,
    appearance: "interaction-only",
    callback: (token: string) => {
      console.log("[turnstile] puzzle token ready");
      puzzleToken = token;
      puzzleTokenResolve?.(token);
      puzzleTokenResolve = null;
    },
    "error-callback": () => {
      console.warn("[turnstile] puzzle widget error");
      puzzleTokenResolve?.(null);
      puzzleTokenResolve = null;
    },
  });
  console.log("[turnstile] puzzle widget rendered, widgetId:", puzzleWidgetId);
  puzzleInitResolve?.();
}

async function getPuzzleTurnstileToken(): Promise<string | null> {
  // wait up to 10s for widget init — handles race with Turnstile script load on cold page load
  await Promise.race([
    puzzleInitPromise,
    new Promise<void>((r) => setTimeout(r, 10_000)),
  ]);
  console.log("[turnstile] getPuzzleTurnstileToken called", {
    puzzleWidgetId,
    hasToken: !!puzzleToken,
  });
  if (!puzzleWidgetId || !window.turnstile) return null;
  if (puzzleToken) {
    const token = puzzleToken;
    puzzleToken = null;
    window.turnstile.reset?.(puzzleWidgetId);
    return token;
  }
  // token not ready yet — wait for callback
  return new Promise((resolve) => {
    puzzleTokenResolve = resolve;
  });
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface ApiUser {
  id: number;
  email: string;
  displayName: string;
  participationStreak: number;
  winStreak: number;
}

export interface SolveData {
  strikesAllowed: number;
  strikesUsed: number;
  movesFound: number;
  targetMoves: number;
  guesses: string; // comma-separated UCI moves
  hiddenGems: string | null; // JSON array of {move, san, eval, diffBest, diffPos, depth}
  timeMs: number;
}

// ── Config ───────────────────────────────────────────────────────────────────

export async function getConfig(): Promise<{
  turnstileSiteKey: string;
} | null> {
  try {
    const res = await fetch(`${BASE}/config`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export async function getMe(): Promise<ApiUser | null> {
  try {
    const res = await fetch(`${BASE}/auth/me`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function logout(): Promise<void> {
  await fetch(`${BASE}/auth/logout`, { method: "POST" });
}

export async function deleteAccount(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/auth/account`, { method: "DELETE" });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Telemetry ─────────────────────────────────────────────────────────────────

export async function trackVisit(turnstileToken: string): Promise<void> {
  console.log("[telemetry] trackVisit", turnstileToken);
  try {
    await fetch(`${BASE}/telemetry/visit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ turnstileToken }),
    });
  } catch {
    // fire and forget — never crash the app over telemetry
    console.warn("[telemetry] trackVisit failed");
  }
}

// ── Puzzles ───────────────────────────────────────────────────────────────────

export async function trackPuzzleVisit(zobrist: string): Promise<void> {
  try {
    console.log("[puzzle] trackPuzzleVisit", zobrist);
    const turnstileToken = await getPuzzleTurnstileToken();
    console.log(
      "[puzzle] visit token:",
      turnstileToken ? "ok" : "null — skipping",
    );
    if (!turnstileToken) return;
    const res = await fetch(`${BASE}/puzzles/${zobrist}/visit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ turnstileToken }),
    });
    console.log("[puzzle] visit response:", res.status, await res.text());
  } catch {
    // fire and forget
  }
}

export async function trackPuzzleSolve(
  zobrist: string,
  data: SolveData,
): Promise<void> {
  try {
    console.log("[puzzle] trackPuzzleSolve", zobrist);
    const turnstileToken = await getPuzzleTurnstileToken();
    console.log(
      "[puzzle] solve token:",
      turnstileToken ? "ok" : "null — skipping",
    );
    if (!turnstileToken) return;
    await fetch(`${BASE}/puzzles/${zobrist}/solve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, turnstileToken }),
    });
  } catch {
    // fire and forget
  }
}

// ── Solves (user history) ─────────────────────────────────────────────────────

export async function getDailySolve(date: string): Promise<{
  movesFound: number;
  targetMoves: number;
  guesses: string;
  hiddenGems: string | null;
} | null> {
  try {
    const res = await fetch(`${BASE}/solves/daily/${date}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function saveSolve(
  zobrist: string | null,
  data: SolveData,
): Promise<{ participationStreak: number; winStreak: number } | null> {
  try {
    const res = await fetch(`${BASE}/solves`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ zobrist, ...data }),
    });
    if (!res.ok) return null;
    const json = await res.json<{
      id: number;
      participationStreak?: number;
      winStreak?: number;
    }>();
    if (
      json.participationStreak !== undefined &&
      json.winStreak !== undefined
    ) {
      return {
        participationStreak: json.participationStreak,
        winStreak: json.winStreak,
      };
    }
    return null;
  } catch {
    return null;
  }
}
