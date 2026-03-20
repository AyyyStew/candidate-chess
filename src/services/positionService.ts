import type { Position, PositionPV } from "../types";
import { makePosition } from "../types";

interface RawPV {
  best_move: string;
  cp: number;
  line: string;
  tactics?: string[];
}

interface RawPosition {
  id: string;
  fen: string;
  move_number: number;
  side_to_move: "white" | "black";
  tag: string;
  phase: string;
  category: string;
  balance: string;
  complexity: string[];
  tactics: string[];
  spreads: {
    spread_1_2: number;
    spread_1_3: number;
    spread_1_5: number;
    spread_2_4: number;
    best_cp: number;
  };
  features: {
    mobility: number;
    captures: number;
    checks: number;
    blocked_pawns: number;
    pawn_tension: number;
  };
  source_game: {
    white: string;
    black: string;
    white_elo: string | number;
    black_elo: string | number;
    opening?: string;
    eco?: string;
    date: string;
    pgn?: string;
  };
  evals: Array<{
    depth: number;
    pvs: RawPV[];
    multipv: number;
  }>;
  daily_date?: string;
}

function toPosition(raw: RawPosition): Position {
  // Support both new format (evals[]) and old daily format (eval.pvs directly)
  const rawPvs: RawPV[] = raw.evals
    ? raw.evals.reduce(
        (best, e) => (e.depth > best.depth ? e : best),
        raw.evals[0],
      ).pvs
    : ((raw as any).eval?.pvs ?? []);
  const pvs: PositionPV[] = rawPvs.map((pv) => ({
    best_move: pv.best_move,
    cp: pv.cp,
    line: pv.line,
  }));
  return makePosition({
    id: raw.id,
    fen: raw.fen,
    label: `${raw.source_game.white} (${raw.source_game.white_elo}) vs ${raw.source_game.black} (${raw.source_game.black_elo})`,
    event: raw.source_game.date ?? "",
    moveNumber: raw.move_number,
    orientation: raw.side_to_move === "white" ? "white" : "black",
    moves: pvs.map((pv) => pv.best_move),
    pvs,
    pgn: raw.source_game.pgn ?? null,
  });
}

// ── General chunks ───────────────────────────────────────────────────────────

const HEX_DIGITS = "0123456789abcdef".split("");
const chunkCache = new Map<string, RawPosition[]>();

async function loadChunk(digit: string): Promise<RawPosition[]> {
  if (chunkCache.has(digit)) return chunkCache.get(digit)!;
  const res = await fetch(`/positions/chunks/${digit}.json`);
  if (!res.ok) throw new Error(`Failed to load position chunk "${digit}"`);
  const chunk: RawPosition[] = await res.json();
  chunkCache.set(digit, chunk);
  return chunk;
}

export async function getRandomPosition(): Promise<Position> {
  const digit = HEX_DIGITS[Math.floor(Math.random() * HEX_DIGITS.length)];
  const chunk = await loadChunk(digit);
  // Pre-warm a second random chunk in the background
  const next = HEX_DIGITS[Math.floor(Math.random() * HEX_DIGITS.length)];
  if (!chunkCache.has(next)) loadChunk(next);
  const raw = chunk[Math.floor(Math.random() * chunk.length)];
  return toPosition(raw);
}

export async function getPositionById(id: string): Promise<Position> {
  const digit = id[0];
  const chunk = await loadChunk(digit);
  const raw = chunk.find((p) => p.id === id);
  if (!raw) throw new Error(`No position with id "${id}"`);
  return toPosition(raw);
}

// ── Daily ────────────────────────────────────────────────────────────────────

let scheduleCache: Record<string, string> | null = null;

function getTodayString(): string {
  return new Date().toISOString().split("T")[0];
}

async function loadDailySchedule(): Promise<Record<string, string>> {
  if (scheduleCache) return scheduleCache;
  const res = await fetch("/positions/daily_schedule.json");
  if (!res.ok) throw new Error("Failed to load daily schedule");
  scheduleCache = await res.json();
  return scheduleCache!;
}

export async function getDailyPosition(
  date?: string,
): Promise<Position | null> {
  const schedule = await loadDailySchedule();
  const target = date ?? getTodayString();
  const id = schedule[target];
  if (!id) return null;
  return getPositionById(id);
}

// ── Preload ──────────────────────────────────────────────────────────────────

export async function preload(): Promise<void> {
  await Promise.all([loadDailySchedule(), loadChunk("0")]);
}
