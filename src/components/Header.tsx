import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const navLinks = [
  { to: "/", label: "Daily" },
  { to: "/random", label: "Random" },
  { to: "/library", label: "Library" },
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
  const { user, loading } = useAuth();
  const navigate = useNavigate();

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
            {!loading && (
              <>
                {user ? (
                  <button
                    onClick={() => navigate("/profile")}
                    className="px-2 py-1.5 text-sm font-semibold text-label hover:text-accent transition-all"
                  >
                    {user.displayName}
                  </button>
                ) : (
                  <button
                    onClick={() => navigate("/login")}
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
          {!loading && (
            <>
              <hr className="border-edge-hi my-1" />
              {user ? (
                <NavLink
                  to="/profile"
                  className="px-4 py-3 rounded-lg text-sm font-semibold text-label hover:text-accent hover:bg-surface-hi transition-all"
                >
                  {user.displayName}
                </NavLink>
              ) : (
                <NavLink
                  to="/login"
                  className="px-4 py-3 rounded-lg text-sm font-semibold bg-accent text-white hover:opacity-90 transition-opacity text-left"
                >
                  Sign in
                </NavLink>
              )}
            </>
          )}
        </nav>
      )}
    </header>
  );
}
