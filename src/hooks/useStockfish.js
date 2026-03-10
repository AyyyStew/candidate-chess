import { useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";

export function useStockfish() {
  const analyzeWorkerRef = useRef(null); // dedicated to top moves
  const evaluateWorkerRef = useRef(null); // dedicated to candidate evals
  const [ready, setReady] = useState(false);
  const readyCount = useRef(0);

  useEffect(() => {
    function makeWorker(multiPV) {
      const worker = new Worker("/stockfish.js");
      worker.postMessage("uci");
      worker.postMessage(`setoption name MultiPV value ${multiPV}`);
      worker.postMessage("isready");
      return worker;
    }

    const w1 = makeWorker(10); // analyze worker — needs MultiPV
    const w2 = makeWorker(1); // evaluate worker — single PV is faster

    // Wait for both workers to be ready
    function onReady(event) {
      if (typeof event.data !== "string") return;
      if (event.data.trim() === "readyok") {
        readyCount.current += 1;
        if (readyCount.current >= 2) setReady(true);
      }
    }
    w1.onmessage = onReady;
    w2.onmessage = onReady;

    analyzeWorkerRef.current = w1;
    evaluateWorkerRef.current = w2;

    return () => {
      w1.terminate();
      w2.terminate();
    };
  }, []);

  // Get top N moves for a position
  function analyze(fen, depth = 12) {
    return new Promise((resolve) => {
      const worker = analyzeWorkerRef.current;
      const results = {};

      worker.onmessage = (event) => {
        if (typeof event.data !== "string") return;
        const line = event.data.trim();

        if (line.startsWith("info") && line.includes("multipv")) {
          const pvMatch = line.match(/multipv (\d+).*pv (\S+)/);
          const scoreMatch = line.match(/score cp (-?\d+)/);
          const depthMatch = line.match(/depth (\d+)/);
          if (pvMatch && scoreMatch && parseInt(depthMatch[1]) === depth) {
            const uciMove = pvMatch[2];
            const tempGame = new Chess(fen);
            let san = uciMove;
            try {
              const m = tempGame.move({
                from: uciMove.slice(0, 2),
                to: uciMove.slice(2, 4),
                promotion: "q",
              });
              san = m.san;
            } catch {}
            results[pvMatch[1]] = {
              move: uciMove,
              san,
              eval: parseInt(scoreMatch[1]) / 100,
            };
          }
        }

        if (line.startsWith("bestmove")) {
          resolve(Object.values(results).slice(0, 10));
        }
      };

      worker.postMessage("stop");
      worker.postMessage(`position fen ${fen}`);
      worker.postMessage(`go depth ${depth}`);
    });
  }

  // Get eval for a single move
  function evaluateMove(fen, move, depth = 12) {
    return new Promise((resolve) => {
      const worker = evaluateWorkerRef.current;
      const game = new Chess(fen);
      game.move({
        from: move.slice(0, 2),
        to: move.slice(2, 4),
        promotion: "q",
      });
      const fenAfter = game.fen();
      let lastEval = null;

      worker.onmessage = (event) => {
        if (typeof event.data !== "string") return;
        const line = event.data.trim();

        if (line.startsWith("info") && line.includes("score cp")) {
          const scoreMatch = line.match(/score cp (-?\d+)/);
          if (scoreMatch) lastEval = parseInt(scoreMatch[1]) / 100;
        }

        if (line.startsWith("bestmove")) {
          resolve(lastEval !== null ? -lastEval : 0);
        }
      };

      worker.postMessage("stop");
      worker.postMessage(`position fen ${fenAfter}`);
      worker.postMessage(`go depth ${depth}`);
    });
  }

  return { ready, analyze, evaluateMove };
}
