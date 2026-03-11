import React from "react";

export default function Header({ dark, onToggle }) {
  return (
    <header className="flex items-center justify-between px-8 py-4 border-b border-gray-200 dark:border-gray-800">
      <h1 className="text-xl font-bold tracking-tight">♟ Candidate Chess </h1>
      <button
        onClick={onToggle}
        className="px-3 py-1.5 rounded-lg text-sm bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
      >
        {dark ? "☀ Light" : "☾ Dark"}
      </button>
    </header>
  );
}
