// FILE: src/hooks/usePositionQueue.js
import { useRef, useState, useEffect } from "react";
import { getRandomPosition } from "../services/dailyService";

export function usePositionQueue({ engine, goCommand, searchMoveCount }) {
  const [current, setCurrent] = useState(() => getRandomPosition());
  const nextRef = useRef(null);
  const preloadingRef = useRef(false);

  function preloadNext() {
    if (preloadingRef.current) return;
    preloadingRef.current = true;
    const position = getRandomPosition();
    engine
      .preloadAnalysis(position.fen, searchMoveCount, goCommand)
      .then((result) => {
        preloadingRef.current = false;
        if (!result) {
          console.log(
            "[preloadNext] result was null — engine returned nothing",
          );
          return;
        }
        console.log(
          "[preloadNext] done, topMoves:",
          result.topMoves?.length,
          "positionEval:",
          result.positionEval,
        );
        nextRef.current = { position, ...result };
      });
  }

  useEffect(() => {
    if (engine.ready) preloadNext();
  }, [engine.ready]);

  function advance() {
    const cached = nextRef.current;
    console.log(
      "[advance] cached:",
      !!cached,
      "| preloading:",
      preloadingRef.current,
    );
    console.log("[advance] t=", performance.now());
    nextRef.current = null;

    // Rotate first so the new standby starts warming up ASAP
    engine.rotate();

    if (cached) {
      setCurrent(cached.position);
      // Preload the position after that on the freshly-spawned standby
      preloadNext();
      return {
        position: cached.position,
        topMoves: cached.topMoves,
        positionEval: cached.positionEval,
        preloaded: true,
      };
    }

    // Fallback — preload wasn't ready
    const position = getRandomPosition();
    setCurrent(position);
    preloadNext();
    return { position, topMoves: null, positionEval: null, preloaded: false };
  }

  return { current, advance };
}
