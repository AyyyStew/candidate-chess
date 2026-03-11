import React, { createContext, useContext } from "react";
import { useEnginePool } from "../hooks/useEnginePool";
import { useEngineAnalysis } from "../hooks/useEngineAnalysis";

const EngineContext = createContext(null);

export function EngineProvider({ children }) {
  const engine = useEnginePool();
  const engineAnalysis = useEngineAnalysis({ engine });

  return (
    <EngineContext.Provider value={{ engine, engineAnalysis }}>
      {children}
    </EngineContext.Provider>
  );
}

export function useEngine() {
  const ctx = useContext(EngineContext);
  if (!ctx) throw new Error("useEngine must be used inside EngineProvider");
  return ctx;
}
