// src/components/LoadingPanel.jsx
import React from "react";

export default function LoadingPanel({ ready }) {
  return (
    <p className="text-sm text-gray-400 animate-pulse">
      {ready ? "Starting analysis..." : "Engine loading..."}
    </p>
  );
}
