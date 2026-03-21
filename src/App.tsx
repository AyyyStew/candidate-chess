import { useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import { EngineProvider } from "./contexts/EngineContext";
import { AuthProvider } from "./contexts/AuthContext";
import Header from "./components/Header";
import DailyPage from "./pages/DailyPage";
import GamePage from "./pages/RandomPage";
import StudyPage from "./pages/StudyPage";
import PracticePage from "./pages/PracticePage";
import AboutPage from "./pages/AboutPage";
import { preload } from "./services/positionService";
import { trackVisit } from "./services/api";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: Record<string, unknown>,
      ) => string;
    };
    onTurnstileLoad?: () => void;
  }
}

let turnstileRendered = false;

export default function App() {
  useEffect(() => {
    preload().catch(console.error);
  }, []);

  useEffect(() => {
    const sitekey = import.meta.env.VITE_TURNSTILE_SITE_KEY as
      | string
      | undefined;
    if (!sitekey || turnstileRendered) return;

    function render() {
      if (turnstileRendered) return;
      turnstileRendered = true;
      try {
        window.turnstile!.render("#turnstile-widget", {
          sitekey,
          appearance: "interaction-only",
          retry: "never",
          callback: (token: string) => trackVisit(token),
          "error-callback": () => {},
        });
      } catch {
        turnstileRendered = false;
      }
    }

    if (window.turnstile) {
      render();
    } else {
      window.onTurnstileLoad = render;
    }
  }, []);

  return (
    <AuthProvider>
      <div className="min-h-screen bg-bg text-text">
        <div id="turnstile-widget" className="hidden" />
        <Header />
        <EngineProvider>
          <Routes>
            <Route path="/" element={<DailyPage />} />
            <Route path="/random" element={<GamePage />} />
            <Route path="/practice" element={<PracticePage />} />
            <Route path="/study" element={<StudyPage />} />
            <Route path="/about" element={<AboutPage />} />
          </Routes>
        </EngineProvider>
      </div>
    </AuthProvider>
  );
}
