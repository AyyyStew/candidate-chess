import React from "react";

interface FenInputProps {
  value: string;
  onChange: (value: string) => void;
  onSet: () => void;
  disabled: boolean;
}

export default function FenInput({
  value,
  onChange,
  onSet,
  disabled,
}: FenInputProps) {
  return (
    <div className="flex gap-2">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Paste a FEN, or leave blank for starting position"
        disabled={disabled}
        className="flex-1 px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
      />
      <button
        onClick={onSet}
        disabled={disabled}
        className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
      >
        Set Position
      </button>
    </div>
  );
}
