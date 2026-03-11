import React from "react";
import { useEngine } from "../contexts/EngineContext";

export default function LoadingPanel() {
  const { engine } = useEngine();

  return (
    <p className="text-sm text-gray-400 animate-pulse">
      {engine.ready ? "Starting analysis..." : "Engine loading..."}
    </p>
  );
}
