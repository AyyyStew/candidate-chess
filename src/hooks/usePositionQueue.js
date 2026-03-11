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
        if (!result) return;
        nextRef.current = { position, ...result };
      });
  }

  useEffect(() => {
    if (engine.ready) preloadNext();
  }, [engine.ready]);

  function advance() {
    if (nextRef.current) {
      const { position, topMoves, positionEval } = nextRef.current;
      nextRef.current = null;
      setCurrent(position);
      // only rotate after we've grabbed the preloaded data
      engine.rotate();
      preloadNext();
      return { position, topMoves, positionEval, preloaded: true };
    }

    // Fallback — preload wasn't ready
    const position = getRandomPosition();
    setCurrent(position);
    engine.rotate();
    preloadNext();
    return { position, topMoves: null, positionEval: null, preloaded: false };
  }

  return { current, advance };
}
