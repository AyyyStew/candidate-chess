import React from "react";
import { NavLink } from "react-router-dom";

interface HeaderProps {
  dark: boolean;
  onToggle: () => void;
}

const navLinks = [
  { to: "/", label: "Daily" },
  { to: "/random", label: "Random" },
  { to: "/practice", label: "Practice" },
  { to: "/study", label: "Study" },
];

export default function Header({ dark, onToggle }: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-8 py-4 border-b border-gray-200 dark:border-gray-800">
      <h1 className="text-xl font-bold tracking-tight">♟ Candidate Chess</h1>
      <div className="flex items-center gap-3">
        <nav className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 text-sm">
          {navLinks.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end
              className={({ isActive }) =>
                `px-3 py-1.5 transition-colors ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <button
          onClick={onToggle}
          className="px-3 py-1.5 rounded-lg text-sm bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
        >
          {dark ? "☀ Light" : "☾ Dark"}
        </button>
      </div>
    </header>
  );
}
