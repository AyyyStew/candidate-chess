import { NavLink } from "react-router-dom";

const navLinks = [
  { to: "/", label: "Daily" },
  { to: "/random", label: "Random" },
  { to: "/practice", label: "Practice" },
  { to: "/study", label: "Study" },
];

export default function Header() {
  return (
    <header className="sticky top-0 z-10 bg-surface border-b border-edge-hi shadow-lg shadow-black/40 flex items-center justify-between px-8 py-4">
      <NavLink
        to="/"
        className="flex items-center gap-2.5 font-black text-xl tracking-tight hover:opacity-75 transition-opacity"
      >
        <span className="text-yellow-400 text-2xl">♟</span>
        <span>Candidate Chess</span>
      </NavLink>

      <nav className="flex items-center gap-1">
        {navLinks.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            end
            className={({ isActive }) =>
              `px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                isActive
                  ? "bg-accent text-white"
                  : "text-muted hover:text-label hover:bg-surface-hi"
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
