// FILE: src/hooks/useGameCoordinator.js
import { useEffect, useRef, useState } from "react";
import { createEngineCoordinator } from "../engine/engineCoordinator";

export function useGameCoordinator(options = {}) {
  const coordinatorRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const coordinator = createEngineCoordinator(options);
    coordinatorRef.current = coordinator;

    coordinator.onReady(() => {
      setReady(true);
      coordinator.preloadNext(); // start preloading only after engine is confirmed ready
    });

    // Safety timeout: if engine hasn't reported ready in 10s, force-start anyway
    // so the user isn't stuck on a blank screen
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
