import { useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import { EngineProvider } from "./contexts/EngineContext";
import { AuthProvider } from "./contexts/AuthContext";
import Header from "./components/Header";
import Footer from "./components/Footer";
import DailyPage from "./pages/DailyPage";
import GamePage from "./pages/RandomPage";
import StudyPage from "./pages/StudyPage";
import CustomPage from "./pages/CustomPage";
import AboutPage from "./pages/AboutPage";
import LoginPage from "./pages/LoginPage";
import ProfilePage from "./pages/ProfilePage";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import TermsPage from "./pages/TermsPage";
import NewsPage from "./pages/NewsPage";
import NewsPostPage from "./pages/NewsPostPage";
import LibraryPage from "./pages/LibraryPage";
import { preload } from "./services/positionService";
import { trackVisit, initPuzzleTurnstile, getConfig } from "./services/api";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: Record<string, unknown>,
      ) => string;
      execute?: (widgetId: string) => void;
      reset?: (widgetId: string) => void;
    };
    onTurnstileLoad?: () => void;
    __turnstileReady?: boolean;
    __pendingTurnstileLoad?: () => void;
  }
}

let turnstileRendered = false;

export default function App() {
  useEffect(() => {
    preload().catch(console.error);
  }, []);

  useEffect(() => {
    getConfig().then((config) => {
      const sitekey = config?.turnstileSiteKey;
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

      const init = () => {
        render();
        initPuzzleTurnstile(sitekey);
      };
      if (window.__turnstileReady || window.turnstile) {
        init();
      } else {
        window.__pendingTurnstileLoad = init;
      }
    });
  }, []);

  return (
    <AuthProvider>
      <div className="min-h-screen bg-bg text-text flex flex-col">
        <div id="turnstile-widget" className="hidden" />
        <div id="puzzle-turnstile-widget" className="hidden" />
        <Header />
        <EngineProvider>
          <Routes>
            <Route path="/" element={<DailyPage />} />
            <Route path="/random" element={<GamePage />} />
            <Route path="/custom" element={<CustomPage />} />
            <Route path="/study" element={<StudyPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/news" element={<NewsPage />} />
            <Route path="/news/:slug" element={<NewsPostPage />} />
            <Route path="/library" element={<LibraryPage />} />
          </Routes>
        </EngineProvider>
        <Footer />
      </div>
    </AuthProvider>
  );
}
