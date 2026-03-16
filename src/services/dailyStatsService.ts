// Daily stats service — backed by localStorage.
// Swap this file's implementations to use a real backend.

export interface StoredCandidate {
  san: string;
  isHit: boolean;
  rank: number | null;
  category: { label: string; icon: string; color: string } | null;
  eval: number | null;
}

export interface DailyRecord {
  date: string; // YYYY-MM-DD
  hits: number;
  target: number;
  won: boolean;
  squares: string[]; // ordered emoji per guess e.g. ["4️⃣", "❌", "❌", "1️⃣", "❌"]
  candidates: StoredCandidate[]; // user's guesses in submission order
  answers: StoredCandidate[]; // top N moves in rank order (the correct answers)
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

function prevDay(isoDate: string): string {
  const d = new Date(isoDate + "T00:00:00");
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

// ── Public API ─────────────────────────────────────────────────────────────

export function getDailyRecord(date: string): DailyRecord | null {
  return load().records[date] ?? null;
}

export function saveDailyResult(record: DailyRecord): void {
  const data = load();
  data.records[record.date] = record;
  persist(data);
}

/** Consecutive days played, counting backward from today (or yesterday if today isn't played yet). */
export function getParticipationStreak(today: string): number {
  const { records } = load();
  const dates = Object.keys(records).sort().reverse();
  if (dates.length === 0) return 0;

  const yesterday = prevDay(today);
  const latest = dates[0];

  // Streak is broken if last play was before yesterday
  if (latest < yesterday) return 0;

  let streak = 0;
  let expected = latest;
  for (const date of dates) {
    if (date === expected) {
      streak++;
      expected = prevDay(expected);
    } else {
      break;
    }
  }
  return streak;
}

/** Consecutive days won, counting backward from today (or yesterday if today isn't played yet). */
export function getWinStreak(today: string): number {
  const { records } = load();
  const dates = Object.keys(records).sort().reverse();
  if (dates.length === 0) return 0;

  const yesterday = prevDay(today);
  const latest = dates[0];

  if (latest < yesterday) return 0;

  let streak = 0;
  let expected = latest;
  for (const date of dates) {
    if (date !== expected) break;
    if (!records[date].won) break;
    streak++;
    expected = prevDay(expected);
  }
  return streak;
}
