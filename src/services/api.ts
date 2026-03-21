const BASE = "/api/v1";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ApiUser {
  id: number;
  email: string;
  displayName: string;
}

export interface SolveData {
  strikesAllowed: number;
  strikesUsed: number;
  movesFound: number;
  totalMoves: number;
  guesses: string; // comma-separated UCI moves
  timeMs: number;
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

// ── Telemetry ─────────────────────────────────────────────────────────────────

export async function trackVisit(turnstileToken: string): Promise<void> {
  try {
    await fetch(`${BASE}/telemetry/visit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ turnstileToken }),
    });
  } catch {
    // fire and forget — never crash the app over telemetry
  }
}

// ── Puzzles ───────────────────────────────────────────────────────────────────

export async function trackPuzzleVisit(zobrist: string): Promise<void> {
  try {
    await fetch(`${BASE}/puzzles/${zobrist}/visit`, { method: "POST" });
  } catch {
    // fire and forget
  }
}

export async function trackPuzzleSolve(
  zobrist: string,
  data: SolveData,
): Promise<void> {
  try {
    await fetch(`${BASE}/puzzles/${zobrist}/solve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  } catch {
    // fire and forget
  }
}

// ── Solves (user history) ─────────────────────────────────────────────────────

export async function saveSolve(
  zobrist: string | null,
  data: SolveData,
): Promise<void> {
  try {
    await fetch(`${BASE}/solves`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ zobrist, ...data }),
    });
  } catch {
    // fire and forget
  }
}
