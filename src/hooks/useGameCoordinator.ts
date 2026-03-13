import { useState, useEffect } from "react";
import { useRef } from "react";
import { useSharedCoordinator } from "../contexts/EngineContext";
import type { EngineCoordinator } from "../engine/engineCoordinator";

export function useGameCoordinator() {
  const coordinator = useSharedCoordinator();
  const coordinatorRef = useRef<EngineCoordinator>(coordinator);
  const [ready, setReady] = useState(coordinator.ready);

  // Keep ref in sync (coordinator is stable, but ref pattern matches GamePage's usage)
  coordinatorRef.current = coordinator;

  useEffect(() => {
    if (coordinator.ready) {
      setReady(true);
      return;
    }
    coordinator.onReady(() => setReady(true));
  }, [coordinator]);

  return { coordinatorRef, ready };
}
