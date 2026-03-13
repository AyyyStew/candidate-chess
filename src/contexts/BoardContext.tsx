import React, { createContext, useContext, ReactNode } from "react";
import { useBoardSetup } from "../hooks/useBoardSetup";

type BoardContextValue = ReturnType<typeof useBoardSetup>;
const BoardContext = createContext<BoardContextValue | null>(null);

interface BoardProviderProps {
  initialFen?: string;
  initialOrientation?: "white" | "black";
  children: ReactNode;
}

export function BoardProvider({
  initialFen,
  initialOrientation,
  children,
}: BoardProviderProps) {
  const board = useBoardSetup({ initialFen, initialOrientation });
  return (
    <BoardContext.Provider value={board}>{children}</BoardContext.Provider>
  );
}

export function useBoard(): BoardContextValue {
  const ctx = useContext(BoardContext);
  if (!ctx) throw new Error("useBoard must be used inside BoardProvider");
  return ctx;
}
