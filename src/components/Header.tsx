import React from "react";
import { NavLink } from "react-router-dom";

const navLinks = [
  { to: "/", label: "Daily" },
  { to: "/random", label: "Random" },
  { to: "/practice", label: "Practice" },
  { to: "/study", label: "Study" },
];

export default function Header() {
  return (
    <header className="flex items-center justify-between px-8 py-4 border-b border-edge">
      <h1 className="text-xl font-bold tracking-tight">♟ Candidate Chess</h1>
      <nav className="flex rounded-lg overflow-hidden border border-edge-hi text-sm">
        {navLinks.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            end
            className={({ isActive }) =>
              `px-3 py-1.5 transition-colors ${
                isActive
                  ? "bg-accent text-white"
                  : "bg-surface text-label hover:bg-surface-hi"
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
