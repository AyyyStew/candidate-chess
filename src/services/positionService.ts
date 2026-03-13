import type { Position } from "../types";
import { POSITIONS } from "../data/positions";

export function getRandomPosition(): Position {
  const index = Math.floor(Math.random() * POSITIONS.length);
  return POSITIONS[index];
}

export function getDailyPosition(): Position {
  const dayIndex =
    Math.floor(Date.now() / (1000 * 60 * 60 * 24)) % POSITIONS.length;
  return POSITIONS[dayIndex];
}

export function getPositionById(id: number): Position | null {
  return POSITIONS.find((p) => p.id === id) ?? null;
}
// Future: swap this for a fetch() call
// export async function getRandomPosition() {
//   const res = await fetch("/api/positions/random");
//   return res.json();
// }

// Future: daily
// export async function getDailyPosition() {
//   const res = await fetch("/api/positions/daily");
//   return res.json();
// }
