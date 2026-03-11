import React from "react";
import { useStockfish } from "./hooks/useStockfish";
import { useDarkMode } from "./hooks/useDarkMode";
import { useBoardSetup } from "./hooks/useBoardSetup";
import { useAnalysis } from "./hooks/useAnalysis";
import Header from "./components/Header";
import BoardPanel from "./components/BoardPanel";
import ControlPanel from "./components/ControlPanel";

export default function App() {
  const { dark, toggleDark } = useDarkMode();
  const engine = useStockfish();
  const board = useBoardSetup();
  const analysis = useAnalysis({ fen: board.fen, engine });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors duration-200">
      <Header dark={dark} onToggle={toggleDark} />
      <main className="flex gap-8 p-8 max-w-6xl mx-auto">
        <BoardPanel board={board} analysis={analysis} />
        <ControlPanel board={board} analysis={analysis} engine={engine} />
      </main>
    </div>
  );
}
