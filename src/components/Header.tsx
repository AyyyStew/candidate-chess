import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  CalendarDays,
  Shuffle,
  BookOpen,
  Wrench,
  GraduationCap,
  LogIn,
  UserRound,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";

const navLinks: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/", label: "Daily", icon: CalendarDays },
  { to: "/random", label: "Random", icon: Shuffle },
  { to: "/library", label: "Library", icon: BookOpen },
  { to: "/custom", label: "Custom", icon: Wrench },
  { to: "/study", label: "Study", icon: GraduationCap },
];

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-1.5 px-2 py-1.5 text-sm font-semibold leading-none transition-all border-b-2 ${
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
      <div className="flex items-center justify-between px-8 py-4 gap-4">
        {/* Left: logo */}
        <NavLink
          to="/"
          className="flex flex-1 shrink-0 items-center gap-2.5 font-black text-xl tracking-loose hover:opacity-75 transition-opacity"
        >
          <img
            src="/candidate_chess_logo.svg"
            alt="Candidate Chess Logo"
            className="w-8 h-8"
          />
          <span>Candidate Chess</span>
        </NavLink>

        {/* Center: game modes (desktop) */}
        <nav className="hidden md:flex flex-1 items-center justify-center gap-3">
          {navLinks.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end className={navLinkClass}>
              {label}
              <Icon size={14} />
            </NavLink>
          ))}
        </nav>

        {/* Right: GitHub + About + Auth (desktop) + hamburger (mobile) */}
        <div className="flex flex-1 items-center justify-end gap-2">
          <div className="hidden md:flex items-center gap-2">
            {!loading && (
              <>
                {user ? (
                  <button
                    onClick={() => navigate("/profile")}
                    className="flex items-center gap-1.5 px-2 py-1.5 text-sm font-semibold text-label hover:text-accent transition-all"
                  >
                    {user.displayName}
                    <UserRound size={14} />
                  </button>
                ) : (
                  <button
                    onClick={() => navigate("/login")}
                    className="flex items-center gap-1.5 px-2 py-1.5 text-sm font-semibold text-muted hover:text-label transition-all"
                  >
                    Sign in
                    <LogIn size={14} />
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
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <nav
          className="md:hidden flex flex-col gap-1 px-6 pt-3 pb-5 border-t border-edge-hi"
          onClick={() => setMenuOpen(false)}
        >
          {navLinks.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end className={mobileNavLinkClass}>
              <span className="flex items-center gap-2">
                <Icon size={15} />
                {label}
              </span>
            </NavLink>
          ))}
          {!loading && (
            <>
              <hr className="border-edge-hi my-1" />
              {user ? (
                <NavLink
                  to="/profile"
                  className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold text-label hover:text-accent hover:bg-surface-hi transition-all"
                >
                  <UserRound size={15} />
                  {user.displayName}
                </NavLink>
              ) : (
                <NavLink
                  to="/login"
                  className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold bg-accent text-white hover:opacity-90 transition-opacity"
                >
                  <LogIn size={15} />
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
