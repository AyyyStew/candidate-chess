import React from "react";

export default function FenInput({ value, onChange, onSet, disabled }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Paste a FEN, or leave blank for starting position"
        style={{ flex: 1, padding: 8 }}
        disabled={disabled}
      />
      <button onClick={onSet} disabled={disabled}>
        Set Position
      </button>
    </div>
  );
}
