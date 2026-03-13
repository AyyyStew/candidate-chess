import React, { createContext, useContext } from "react";
import { useBoardSetup } from "../hooks/useBoardSetup";

const BoardContext = createContext(null);

export function BoardProvider({ initialFen, initialOrientation, children }) {
  const board = useBoardSetup({ initialFen, initialOrientation });

  return (
    <BoardContext.Provider value={board}>{children}</BoardContext.Provider>
  );
}

export function useBoard() {
  const ctx = useContext(BoardContext);
  if (!ctx) throw new Error("useBoard must be used inside BoardProvider");
  return ctx;
}
