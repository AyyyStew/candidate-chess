import { useEffect, useRef, useState } from "react";
import { createEngineCoordinator } from "../engine/engineCoordinator";
import type { EngineCoordinator } from "../engine/engineCoordinator";

export function useGameCoordinator() {
  const coordinatorRef = useRef<EngineCoordinator | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const coordinator = createEngineCoordinator();
    coordinatorRef.current = coordinator;

    coordinator.onReady(() => {
      setReady(true);
      coordinator.preloadNext();
    });

    const timeout = setTimeout(() => {
      if (!coordinatorRef.current?.ready) {
        console.warn("[useGameCoordinator] ready timeout — forcing start");
        setReady(true);
      }
    }, 10_000);

    return () => {
      clearTimeout(timeout);
      coordinator.destroy();
    };
  }, []);

  return { coordinatorRef, ready };
}
