import { useState, useRef } from "react";
import type { Api } from "@lichess-org/chessground/api";
import type { DrawShape } from "@lichess-org/chessground/draw";
import type { Key } from "@lichess-org/chessground/types";
import ChessgroundBoard from "./ChessgroundBoard";
import MoveHistory from "./MoveHistory";
import { useBoard } from "../contexts/BoardContext";
import StudyFromPositionButton from "./StudyFromPositionButton";
import { Chess } from "chess.js";
import { playMoveSound, playBounceSound } from "../utils/sounds";

interface BoardSnap {
  phase: string;
  candidates: { move: string }[];
  results?: { topMoves: { move: string }[] } | null;
  liveTopMoves?: { move: string }[];
}

interface BoardPanelProps {
  snap?: BoardSnap | null;
  onDrop?: (sourceSquare: string, targetSquare: string) => void;
  locked?: boolean;
  onReset?: () => void;
  onStudyFromPosition?: () => void;
  onPlayFromPosition?: () => void;
}

const TOP_MOVE_BRUSHES = ["yellow", "grey", "orange"];

const CUSTOM_BRUSHES = {
  green: { key: "green", color: "#15803d", opacity: 0.8, lineWidth: 10 },
  red: { key: "red", color: "#dc2626", opacity: 0.8, lineWidth: 10 },
  blue: { key: "blue", color: "#3b82f6", opacity: 0.75, lineWidth: 10 },
  yellow: { key: "yellow", color: "#eab308", opacity: 0.92, lineWidth: 10 },
  grey: { key: "grey", color: "#94a3b8", opacity: 0.8, lineWidth: 10 },
  orange: { key: "orange", color: "#b45309", opacity: 0.82, lineWidth: 10 },
};

export default function BoardPanel({
  snap,
  onDrop,
  locked = false,
  onReset,
  onStudyFromPosition,
  onPlayFromPosition,
}: BoardPanelProps) {
  const [showArrows, setShowArrows] = useState(true);
  const board = useBoard();
  const apiRef = useRef<Api | null>(null);

  const {
    boardOrientation,
    flipOrientation,
    moveHistory,
    historyIndex,
    handleNavigate,
    isPreviewing,
  } = board;

  const isIdle = !snap;
  const isActive = snap?.phase === "active";
  const isDone = snap?.phase === "done";

  const candidates = snap?.candidates ?? [];
  const results = snap?.results ?? null;
  const topMovesForArrows =
    results?.topMoves ?? (isDone ? (snap?.liveTopMoves ?? []) : []);

  // ── Legal destinations (active mode only) ──────────────────────────────────
  function buildDests(): Map<Key, Key[]> | undefined {
    if (!isActive) return undefined;
    const chess = new Chess(board.fen);
    const map = new Map<Key, Key[]>();
    for (const m of chess.moves({ verbose: true })) {
      const arr = map.get(m.from as Key) ?? [];
      arr.push(m.to as Key);
      map.set(m.from as Key, arr);
    }
    return map;
  }

  function getTurnColor(): "white" | "black" | undefined {
    if (!isActive) return undefined;
    return new Chess(board.fen).turn() === "w" ? "white" : "black";
  }

  // ── Arrow shapes ────────────────────────────────────────────────────────────
  function buildAutoShapes(): DrawShape[] {
    if (!showArrows || isPreviewing) return [];
    const sq = (move: string, offset: number) =>
      move.slice(offset, offset + 2) as Key;
    return [
      ...candidates.map(
        (c): DrawShape => ({
          orig: sq(c.move, 0),
          dest: sq(c.move, 2),
          brush: "blue",
        }),
      ),
      ...(isDone
        ? topMovesForArrows.slice(0, 3).map(
            (m, i): DrawShape => ({
              orig: sq(m.move, 0),
              dest: sq(m.move, 2),
              brush: TOP_MOVE_BRUSHES[i],
            }),
          )
        : []),
    ];
  }

  // ── Move handler ────────────────────────────────────────────────────────────
  function handleAfter(orig: Key, dest: Key) {
    if (isIdle) {
      const ok = board.handleIdleDrop(orig, dest, board.fen);
      if (ok) {
        playMoveSound();
      } else {
        playBounceSound();
        apiRef.current?.set({ fen: board.fen });
      }
      return;
    }
    if (isActive) {
      try {
        const valid = !!new Chess(board.fen).move({
          from: orig,
          to: dest,
          promotion: "q",
        });
        if (valid) playMoveSound();
        else playBounceSound();
      } catch {
        playBounceSound();
      }
      onDrop?.(orig, dest);
    }
  }

  const turnColor = getTurnColor();

  const cgConfig = {
    fen: board.fen,
    orientation: boardOrientation,
    turnColor,
    blockTouchScroll: true,
    movable: {
      free: isIdle && !isPreviewing,
      color:
        isIdle && !isPreviewing
          ? ("both" as const)
          : isActive
            ? turnColor
            : undefined,
      dests: buildDests(),
      showDests: true,
      events: { after: handleAfter },
    },
    drawable: {
      enabled: false,
      autoShapes: buildAutoShapes(),
      brushes: CUSTOM_BRUSHES,
    },
    animation: { enabled: true },
    highlight: { lastMove: true, check: false },
  };

  return (
    <div className="lg:sticky lg:top-8 lg:self-start">
      <div className="flex flex-col gap-2 w-full lg:w-120 lg:shrink-0">
        <div className="flex gap-2">
          <button
            onClick={() => setShowArrows((a) => !a)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 border ${
              showArrows
                ? "bg-accent/15 text-accent border-accent/40 hover:bg-accent/25"
                : "bg-surface-hi text-muted border-edge-hi hover:text-label hover:bg-interactive"
            }`}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
            Arrows
          </button>
          <button
            onClick={flipOrientation}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-surface-hi text-muted border border-edge-hi hover:text-label hover:bg-interactive transition-all flex items-center gap-1.5"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="17 1 21 5 17 9" />
              <path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <polyline points="7 23 3 19 7 15" />
              <path d="M21 13v2a4 4 0 0 1-4 4H3" />
            </svg>
            Flip
          </button>
        </div>

        <ChessgroundBoard config={cgConfig} apiRef={apiRef} />

        {onStudyFromPosition && (
          <StudyFromPositionButton
            onStudy={onStudyFromPosition}
            onPlay={onPlayFromPosition}
          />
        )}
        {!locked && (
          <>
            <MoveHistory
              history={moveHistory}
              currentIndex={historyIndex}
              onNavigate={handleNavigate}
              disabled={!isIdle}
            />
            <button
              onClick={() => {
                onReset ? onReset() : board.reset();
              }}
              className="mt-2 w-full py-2.5 rounded-xl font-semibold bg-interactive hover:bg-red-700 hover:text-white transition-colors"
            >
              Reset Game
            </button>
          </>
        )}
      </div>
    </div>
  );
}
