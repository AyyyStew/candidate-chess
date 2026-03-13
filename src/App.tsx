import React from "react";
import { Routes, Route } from "react-router-dom";
import { useDarkMode } from "./hooks/useDarkMode";
import { EngineProvider } from "./contexts/EngineContext";
import Header from "./components/Header";
import DailyPage from "./pages/DailyPage";
import GamePage from "./pages/RandomPage";
import StudyPage from "./pages/StudyPage";
import PracticePage from "./pages/PracticePage";

export default function App() {
  const { dark, toggleDark } = useDarkMode();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors duration-200">
      <Header dark={dark} onToggle={toggleDark} />
      <EngineProvider>
        <Routes>
          <Route path="/" element={<DailyPage />} />
          <Route path="/random" element={<GamePage />} />
          <Route path="/practice" element={<PracticePage />} />
          <Route path="/study" element={<StudyPage />} />
        </Routes>
      </EngineProvider>
    </div>
  );
}
