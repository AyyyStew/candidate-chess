import { useState, useRef } from "react";
import { Chess } from "chess.js";
import { STARTING_FEN, isValidFen, parsePgn } from "../utils/chess";

interface MoveHistoryEntry {
  san: string;
  fenAfter: string;
}

export function useBoardSetup({
  initialFen = STARTING_FEN,
  initialOrientation = "white" as "white" | "black",
} = {}) {
  const [fen, setFen] = useState(initialFen);
  const [fenInput, setFenInput] = useState("");
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">(
    initialOrientation,
  );
  const [moveHistory, setMoveHistory] = useState<MoveHistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [baselineFen, setBaselineFen] = useState(initialFen);

  interface Checkpoint {
    fen: string;
    moveHistory: MoveHistoryEntry[];
    historyIndex: number;
    baselineFen: string;
  }
  const [checkpoint, setCheckpoint] = useState<Checkpoint | null>(null);
  const previewIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previewSavedFenRef = useRef<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);

  function handleSetPosition(): void {
    if (!fenInput.trim()) {
      setFen(initialFen);
      setMoveHistory([]);
      setHistoryIndex(-1);
      setCheckpoint(null);
      return;
    }
    if (!isValidFen(fenInput.trim())) {
      alert("Invalid FEN string");
      return;
    }
    setFen(fenInput.trim());
    setMoveHistory([]);
    setHistoryIndex(-1);
    setCheckpoint({ fen: fenInput.trim(), moveHistory: [], historyIndex: -1, baselineFen: fenInput.trim() });
  }

  function handleNavigate(index: number): void {
    const clamped = Math.max(-1, Math.min(index, moveHistory.length - 1));
    setHistoryIndex(clamped);
    setFen(clamped === -1 ? baselineFen : moveHistory[clamped].fenAfter);
    setFenInput(clamped === -1 ? "" : moveHistory[clamped].fenAfter);
  }

  function handleSetPgn(pgn: string): boolean {
    const parsed = parsePgn(pgn);
    if (!parsed) {
      alert("Invalid PGN");
      return false;
    }
    const { moves, initialFen: pgnInitialFen } = parsed;
    setBaselineFen(pgnInitialFen);
    setMoveHistory(moves);
    setHistoryIndex(moves.length - 1);
    setFen(moves[moves.length - 1].fenAfter);
    setFenInput(moves[moves.length - 1].fenAfter);
    setCheckpoint({ fen: moves[moves.length - 1].fenAfter, moveHistory: moves, historyIndex: moves.length - 1, baselineFen: pgnInitialFen });
    return true;
  }

  function handleIdleDrop(
    sourceSquare: string,
    targetSquare: string,
    currentFen: string,
  ): boolean {
    const baseHistory = moveHistory.slice(0, historyIndex + 1);
    const baseFen =
      historyIndex >= 0 ? baseHistory[historyIndex].fenAfter : currentFen;
    const game = new Chess(baseFen);
    let move;
    try {
      move = game.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: "q",
      });
    } catch {
      return false;
    }
    if (!move) return false;
    const newHistory = [
      ...baseHistory,
      { san: move.san, fenAfter: game.fen() },
    ];
    setMoveHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setFen(game.fen());
    setFenInput(game.fen());
    return true;
  }

  function flipOrientation(): void {
    setBoardOrientation((o) => (o === "white" ? "black" : "white"));
  }

  function reset(): void {
    setFen(initialFen);
    setFenInput("");
    setMoveHistory([]);
    setHistoryIndex(-1);
    setBaselineFen(initialFen);
    setCheckpoint(null);
  }

  function resetToCheckpoint(): void {
    if (!checkpoint) {
      reset();
      return;
    }
    setFen(checkpoint.fen);
    setFenInput(checkpoint.historyIndex >= 0 ? checkpoint.fen : "");
    setMoveHistory(checkpoint.moveHistory);
    setHistoryIndex(checkpoint.historyIndex);
    setBaselineFen(checkpoint.baselineFen);
  }

  function truncateToCurrentPosition(): void {
    // Checkpoint keeps the full original history so Start Over can restore it,
    // but records the current index so the board lands on the right position.
    const fullHistory = checkpoint?.moveHistory.length
      ? checkpoint.moveHistory
      : moveHistory;
    setCheckpoint({ fen, moveHistory: fullHistory, historyIndex, baselineFen });

    if (historyIndex < 0) {
      setMoveHistory([]);
    } else {
      setMoveHistory(moveHistory.slice(0, historyIndex + 1));
    }
  }

  function previewLine(startFen: string, sans: string[]): void {
    if (previewIntervalRef.current !== null) {
      clearInterval(previewIntervalRef.current);
      previewIntervalRef.current = null;
    }
    previewSavedFenRef.current = fen;
    setIsPreviewing(true);

    const fens: string[] = [startFen];
    const game = new Chess(startFen);
    for (const san of sans) {
      try {
        game.move(san);
        fens.push(game.fen());
      } catch {
        break;
      }
    }

    setFen(fens[0]);
    let step = 1;
    previewIntervalRef.current = setInterval(() => {
      if (step >= fens.length) {
        clearInterval(previewIntervalRef.current!);
        previewIntervalRef.current = null;
        return;
      }
      setFen(fens[step++]);
    }, 700);
  }

  function showPreviewFen(fenToShow: string): void {
    if (previewIntervalRef.current !== null) {
      clearInterval(previewIntervalRef.current);
      previewIntervalRef.current = null;
    }
    if (previewSavedFenRef.current === null) {
      previewSavedFenRef.current = fen;
    }
    setIsPreviewing(true);
    setFen(fenToShow);
  }

  function clearPreview(): void {
    if (previewIntervalRef.current !== null) {
      clearInterval(previewIntervalRef.current);
      previewIntervalRef.current = null;
    }
    if (previewSavedFenRef.current !== null) {
      setFen(previewSavedFenRef.current);
      previewSavedFenRef.current = null;
    }
    setIsPreviewing(false);
  }

  function snapToEnd(): void {
    if (moveHistory.length === 0) return;
    const last = moveHistory[moveHistory.length - 1];
    setHistoryIndex(moveHistory.length - 1);
    setFen(last.fenAfter);
    setFenInput(last.fenAfter);
  }

  function resetTo(
    fen: string,
    orientation: "white" | "black" = "white",
  ): void {
    setFen(fen);
    setFenInput(fen);
    setMoveHistory([]);
    setHistoryIndex(-1);
    setBoardOrientation(orientation);
  }

  return {
    fen,
    setFen,
    fenInput,
    setFenInput,
    boardOrientation,
    flipOrientation,
    moveHistory,
    historyIndex,
    handleSetPosition,
    handleSetPgn,
    handleNavigate,
    handleIdleDrop,
    truncateToCurrentPosition,
    reset,
    resetToCheckpoint,
    snapToEnd,
    resetTo,
    previewLine,
    showPreviewFen,
    clearPreview,
    isPreviewing,
  };
}
