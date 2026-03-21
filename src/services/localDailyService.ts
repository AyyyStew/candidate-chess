// Local daily service — stores daily results in localStorage.
// Streak tracking is handled by the backend (see /api/v1/auth/me).

import type { Candidate, TopMove } from "../types";

export interface DailyRecord {
  date: string; // YYYY-MM-DD
  fen: string;
  hits: number;
  target: number;
  won: boolean;
  squares: string[]; // ordered emoji per guess e.g. ["4️⃣", "❌", "❌", "1️⃣", "❌"]
  candidates: Candidate[]; // user's guesses in submission order
  answers: TopMove[]; // top N moves in rank order (the correct answers)
}

interface DailyStorage {
  records: Record<string, DailyRecord>;
}

const STORAGE_KEY = "candidatechess_daily";

function load(): DailyStorage {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { records: {} };
  } catch {
    return { records: {} };
  }
}

function persist(data: DailyStorage): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getDailyRecord(date: string): DailyRecord | null {
  return load().records[date] ?? null;
}

export function saveDailyResult(record: DailyRecord): void {
  const data = load();
  data.records[record.date] = record;
  persist(data);
}
