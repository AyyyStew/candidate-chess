import { useState } from "react";
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

  function handleSetPosition(): void {
    if (!fenInput.trim()) {
      setFen(initialFen);
      setMoveHistory([]);
      setHistoryIndex(-1);
      return;
    }
    if (!isValidFen(fenInput.trim())) {
      alert("Invalid FEN string");
      return;
    }
    setFen(fenInput.trim());
    setMoveHistory([]);
    setHistoryIndex(-1);
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
  }

  function truncateToCurrentPosition(): void {
    if (historyIndex < 0) {
      setMoveHistory([]);
      return;
    }
    setMoveHistory(moveHistory.slice(0, historyIndex + 1));
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
    snapToEnd,
    resetTo,
  };
}
