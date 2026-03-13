import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useEnginePool as createPool } from "../engine/enginePool";
import { createEngineCoordinator } from "../engine/engineCoordinator";
import type { EnginePool } from "../engine/enginePool";
import type { EngineCoordinator } from "../engine/engineCoordinator";

interface EngineContextValue {
  pool: EnginePool;
  coordinator: EngineCoordinator;
}

const EngineContext = createContext<EngineContextValue | null>(null);

export function EngineProvider({ children }: { children: React.ReactNode }) {
  // useEnginePool already manages worker lifecycle via useEffect internally
  const pool = createPool();

  // Coordinator is imperative — create once, destroy on unmount
  const coordinatorRef = useRef<EngineCoordinator | null>(null);
  const [coordinator, setCoordinator] = useState<EngineCoordinator | null>(
    null,
  );

  useEffect(() => {
    const c = createEngineCoordinator();
    coordinatorRef.current = c;
    setCoordinator(c);
    return () => c.destroy();
  }, []);

  if (!coordinator) return null; // Engine not yet initialised — render nothing

  return (
    <EngineContext.Provider value={{ pool, coordinator }}>
      {children}
    </EngineContext.Provider>
  );
}

export function useSharedPool(): EnginePool {
  const ctx = useContext(EngineContext);
  if (!ctx)
    throw new Error("useSharedPool must be used inside <EngineProvider>");
  return ctx.pool;
}

export function useSharedCoordinator(): EngineCoordinator {
  const ctx = useContext(EngineContext);
  if (!ctx)
    throw new Error(
      "useSharedCoordinator must be used inside <EngineProvider>",
    );
  return ctx.coordinator;
}
