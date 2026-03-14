import React, { useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import { EngineProvider } from "./contexts/EngineContext";
import Header from "./components/Header";
import DailyPage from "./pages/DailyPage";
import GamePage from "./pages/RandomPage";
import StudyPage from "./pages/StudyPage";
import PracticePage from "./pages/PracticePage";
import { preload } from "./services/positionService";

export default function App() {
  useEffect(() => {
    preload().catch(console.error);
  }, []);

  return (
    <div className="min-h-screen bg-bg text-text">
      <Header />
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
