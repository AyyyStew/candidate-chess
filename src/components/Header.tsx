import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import LoginModal from "./LoginModal";

const navLinks = [
  { to: "/", label: "Daily" },
  { to: "/random", label: "Random" },
  { to: "/practice", label: "Practice" },
  { to: "/study", label: "Study" },
];

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `px-2 py-1.5 text-sm font-semibold transition-all border-b-2 ${
    isActive
      ? "border-accent text-label"
      : "border-transparent text-muted hover:text-label hover:border-edge-hi"
  }`;

const mobileNavLinkClass = ({ isActive }: { isActive: boolean }) =>
  `px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
    isActive
      ? "bg-accent text-white shadow-md shadow-accent/30"
      : "text-muted hover:text-label hover:bg-surface-hi"
  }`;

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const { user, loading, logout } = useAuth();

  return (
    <header className="sticky top-0 z-10 bg-surface border-b border-edge-hi shadow-lg shadow-black/40">
      <div className="grid grid-cols-2 md:grid-cols-3 items-center px-8 py-4">
        {/* Left: logo */}
        <NavLink
          to="/"
          className="flex items-center gap-2.5 font-black text-xl tracking-tight hover:opacity-75 transition-opacity"
        >
          <img
            src="/candidate_chess_logo.svg"
            alt="Candidate Chess Logo"
            className="w-8 h-8"
          />
          <span>Candidate Chess</span>
        </NavLink>

        {/* Center: game modes (desktop) */}
        <nav className="hidden md:flex items-center justify-center gap-1">
          {navLinks.map(({ to, label }) => (
            <NavLink key={to} to={to} end className={navLinkClass}>
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Right: GitHub + About + Auth (desktop) + hamburger (mobile) */}
        <div className="flex items-center justify-end gap-2">
          <div className="hidden md:flex items-center gap-2">
            <NavLink to="/about" className={navLinkClass}>
              About
            </NavLink>
            <a
              href="https://github.com/AyyyStew/candidate-chess"
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg text-muted hover:text-label hover:bg-surface-hi transition-all"
              aria-label="GitHub"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
            </a>
            {!loading && (
              <>
                <div className="w-0.5 h-5 bg-edge-hi rounded-full mx-2" />
                {user ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-label">
                      {user.displayName}
                    </span>
                    <button
                      onClick={logout}
                      className="px-2 py-1.5 text-sm font-semibold text-muted hover:text-label transition-all"
                    >
                      Sign out
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setLoginOpen(true)}
                    className="px-2 py-1.5 text-sm font-semibold text-muted hover:text-label transition-all"
                  >
                    Sign in
                  </button>
                )}
              </>
            )}
          </div>

          {/* Hamburger button (mobile) */}
          <button
            className="md:hidden p-1.5 rounded-lg text-muted hover:text-label hover:bg-surface-hi transition-all"
            aria-label="Toggle menu"
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? (
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <nav
          className="md:hidden flex flex-col gap-1 px-6 pt-3 pb-5 border-t border-edge-hi"
          onClick={() => setMenuOpen(false)}
        >
          {navLinks.map(({ to, label }) => (
            <NavLink key={to} to={to} end className={mobileNavLinkClass}>
              {label}
            </NavLink>
          ))}
          <hr className="border-edge-hi my-1" />
          <NavLink to="/about" className={mobileNavLinkClass}>
            About
          </NavLink>
          <a
            href="https://github.com/AyyyStew/candidate-chess"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-3 rounded-lg text-sm font-semibold text-muted hover:text-label hover:bg-surface-hi transition-all"
          >
            GitHub
          </a>
          {!loading && (
            <>
              <hr className="border-edge-hi my-1" />
              {user ? (
                <>
                  <span className="px-4 py-1 text-xs text-muted">
                    {user.displayName}
                  </span>
                  <button
                    onClick={logout}
                    className="px-4 py-3 rounded-lg text-sm font-semibold text-muted hover:text-label hover:bg-surface-hi transition-all text-left"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    setLoginOpen(true);
                  }}
                  className="px-4 py-3 rounded-lg text-sm font-semibold bg-accent text-white hover:opacity-90 transition-opacity text-left"
                >
                  Sign in
                </button>
              )}
            </>
          )}
        </nav>
      )}

      {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} />}
    </header>
  );
}
