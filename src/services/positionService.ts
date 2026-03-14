import type { Position } from "../types";
import { makePosition } from "../types";

const GENERAL_CHUNK_COUNT = 19;

interface RawPV {
  best_move: string;
  cp: number;
  line: string;
}

interface RawPosition {
  fen: string;
  tag: "daily" | "general";
  daily_date?: string;
  eval: {
    pvs: RawPV[];
  };
  game: {
    white: string;
    black: string;
    white_elo: string | number;
    black_elo: string | number;
    date: string;
  };
}

let positionCounter = 0;

function toPosition(raw: RawPosition): Position {
  const sideToMove = raw.fen.split(" ")[1];
  return makePosition({
    id: positionCounter++,
    fen: raw.fen,
    label: `${raw.game.white} (${raw.game.white_elo}) vs ${raw.game.black} (${raw.game.black_elo})`,
    event: raw.game.date ?? "",
    moveNumber: parseInt(raw.fen.split(" ")[5]) ?? 1,
    orientation: sideToMove === "w" ? "white" : "black",
    moves: raw.eval.pvs.map((pv) => pv.best_move),
  });
}

let dailyCache: RawPosition[] | null = null;
let generalPool: RawPosition[] = [];
let currentChunk = 0;
let isLoadingChunk = false;

function getCurrentYear(): string {
  return new Date().getFullYear().toString();
}

function getTodayString(): string {
  return new Date().toISOString().split("T")[0];
}

async function loadDailyChunk(): Promise<RawPosition[]> {
  if (dailyCache) return dailyCache;
  const year = getCurrentYear();
  const res = await fetch(`/positions/daily/${year}.json`);
  if (!res.ok) throw new Error(`Failed to load daily positions for ${year}`);
  dailyCache = await res.json();
  return dailyCache!;
}

async function loadNextGeneralChunk(): Promise<void> {
  if (isLoadingChunk || currentChunk >= GENERAL_CHUNK_COUNT) return;
  isLoadingChunk = true;
  try {
    const index = currentChunk.toString().padStart(3, "0");
    const res = await fetch(`/positions/general/${index}.json`);
    if (!res.ok) throw new Error(`Failed to load general chunk ${index}`);
    const chunk: RawPosition[] = await res.json();
    generalPool = [...generalPool, ...chunk];
    currentChunk++;
  } finally {
    isLoadingChunk = false;
  }
}

export async function getDailyPosition(): Promise<Position | null> {
  const positions = await loadDailyChunk();
  const today = getTodayString();
  const raw = positions.find((p) => p.daily_date === today) ?? null;
  return raw ? toPosition(raw) : null;
}

export async function getRandomPosition(): Promise<Position> {
  if (generalPool.length === 0) {
    await loadNextGeneralChunk();
  }
  if (generalPool.length < 50) {
    loadNextGeneralChunk();
  }
  const index = Math.floor(Math.random() * generalPool.length);
  return toPosition(generalPool[index]);
}

export async function preload(): Promise<void> {
  await Promise.all([loadDailyChunk(), loadNextGeneralChunk()]);
}
