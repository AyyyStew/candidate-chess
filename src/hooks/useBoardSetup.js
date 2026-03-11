import { useState } from "react";
import { Chess } from "chess.js";
import { STARTING_FEN, isValidFen } from "../utils/chess";

export function useBoardSetup() {
  const [fen, setFen] = useState(STARTING_FEN);
  const [fenInput, setFenInput] = useState("");
  const [boardOrientation, setBoardOrientation] = useState("white");
  const [moveHistory, setMoveHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  function handleSetPosition() {
    if (!fenInput.trim()) {
      setFen(STARTING_FEN);
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

  function handleNavigate(index) {
    const clamped = Math.max(-1, Math.min(index, moveHistory.length - 1));
    setHistoryIndex(clamped);
    setFen(clamped === -1 ? STARTING_FEN : moveHistory[clamped].fenAfter);
    setFenInput(clamped === -1 ? "" : moveHistory[clamped].fenAfter);
  }

  function handleIdleDrop(sourceSquare, targetSquare, currentFen) {
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

  function flipOrientation() {
    setBoardOrientation((o) => (o === "white" ? "black" : "white"));
  }

  function reset() {
    setFen(STARTING_FEN);
    setFenInput("");
    setMoveHistory([]);
    setHistoryIndex(-1);
  }

  function snapToEnd() {
    if (moveHistory.length === 0) return;
    setHistoryIndex(moveHistory.length - 1);
    setFen(moveHistory[moveHistory.length - 1].fenAfter);
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
    handleNavigate,
    handleIdleDrop,
    reset,
    snapToEnd,
  };
}
