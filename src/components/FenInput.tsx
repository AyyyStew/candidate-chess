import { useState } from "react";

interface FenInputProps {
  value: string;
  onChange: (value: string) => void;
  onSet: () => void;
  onSetPgn: (pgn: string) => void;
  disabled: boolean;
  defaultMode?: "fen" | "pgn";
  defaultPgn?: string;
}

export default function FenInput({
  value,
  onChange,
  onSet,
  onSetPgn,
  disabled,
  defaultMode,
  defaultPgn,
}: FenInputProps) {
  const [mode, setMode] = useState<"fen" | "pgn">(defaultMode ?? "fen");
  const [pgnValue, setPgnValue] = useState(defaultPgn ?? "");

  const tabClass = (active: boolean) =>
    `px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
      active
        ? "bg-accent text-white"
        : "bg-surface-hi text-muted hover:bg-interactive-hi"
    }`;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1.5">
        <button
          onClick={() => setMode("fen")}
          disabled={disabled}
          className={tabClass(mode === "fen")}
        >
          FEN
        </button>
        <button
          onClick={() => setMode("pgn")}
          disabled={disabled}
          className={tabClass(mode === "pgn")}
        >
          PGN
        </button>
      </div>

      {mode === "fen" ? (
        <div className="flex gap-2">
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Paste a FEN, or leave blank for starting position"
            disabled={disabled}
            className="flex-1 px-3 py-2 rounded-xl border border-edge-hi bg-surface text-sm placeholder-muted focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <button
            onClick={onSet}
            disabled={disabled}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-interactive hover:bg-interactive-hi disabled:opacity-50 transition-colors"
          >
            Set Position
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <textarea
            value={pgnValue}
            onChange={(e) => setPgnValue(e.target.value)}
            placeholder="Paste PGN here..."
            disabled={disabled}
            rows={5}
            className="w-full px-3 py-2 rounded-xl border border-edge-hi bg-surface text-sm placeholder-muted focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 resize-none font-mono"
          />
          <button
            onClick={() => onSetPgn(pgnValue)}
            disabled={disabled || !pgnValue.trim()}
            className="w-full py-2 rounded-xl text-sm font-semibold bg-interactive hover:bg-interactive-hi disabled:opacity-50 transition-colors"
          >
            Load PGN
          </button>
        </div>
      )}
    </div>
  );
}
