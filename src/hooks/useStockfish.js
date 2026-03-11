import { useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";

export function useStockfish() {
  const analyzeWorkerRef = useRef(null); // top moves (MultiPV)
  const evaluateWorkerRef = useRef(null); // candidate evals
  const positionWorkerRef = useRef(null); // position eval
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

    const w1 = makeWorker(10); // analyze
    const w2 = makeWorker(1); // evaluate moves
    const w3 = makeWorker(1); // evaluate position

    function onReady(event) {
      if (typeof event.data !== "string") return;
      if (event.data.trim() === "readyok") {
        readyCount.current += 1;
        if (readyCount.current >= 3) setReady(true);
      }
    }
    w1.onmessage = onReady;
    w2.onmessage = onReady;
    w3.onmessage = onReady;

    analyzeWorkerRef.current = w1;
    evaluateWorkerRef.current = w2;
    positionWorkerRef.current = w3;

    return () => {
      w1.terminate();
      w2.terminate();
      w3.terminate();
    };
  }, []);

  // Get top N moves for a position
  function analyze(fen, topMovesCount = 10, goCommand = "go depth 12") {
    return new Promise((resolve) => {
      const worker = analyzeWorkerRef.current;
      const results = {};
      const depthMatch = goCommand.match(/depth (\d+)/);
      const targetDepth = depthMatch ? parseInt(depthMatch[1]) : null;

      worker.onmessage = (event) => {
        if (typeof event.data !== "string") return;
        const line = event.data.trim();

        if (line.startsWith("info") && line.includes("multipv")) {
          const pvMatch = line.match(/multipv (\d+).*pv (\S+)/);
          const scoreMatch = line.match(/score cp (-?\d+)/);
          const infoDepth = line.match(/depth (\d+)/);

          // for depth mode, only capture at target depth
          // for movetime mode, keep updating so we always have latest
          const depthOk = targetDepth
            ? parseInt(infoDepth?.[1]) === targetDepth
            : true;

          if (pvMatch && scoreMatch && depthOk) {
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
          resolve(Object.values(results).slice(0, topMovesCount));
        }
      };

      worker.postMessage("stop");
      worker.postMessage(`setoption name MultiPV value ${topMovesCount}`);
      worker.postMessage(`position fen ${fen}`);
      worker.postMessage(goCommand);
    });
  }

  // Get eval for a single move
  function evaluateMove(fen, move, goCommand = "go depth 12") {
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
      worker.postMessage(goCommand);
    });
  }

  function evaluatePosition(fen, goCommand = "go depth 12") {
    return new Promise((resolve) => {
      const worker = positionWorkerRef.current;
      let lastEval = null;

      worker.onmessage = (event) => {
        if (typeof event.data !== "string") return;
        const line = event.data.trim();
        if (line.startsWith("info") && line.includes("score cp")) {
          const scoreMatch = line.match(/score cp (-?\d+)/);
          if (scoreMatch) lastEval = parseInt(scoreMatch[1]) / 100;
        }
        if (line.startsWith("bestmove")) {
          const isWhiteToMove = fen.includes(" w ");
          resolve(
            lastEval !== null ? (isWhiteToMove ? lastEval : -lastEval) : 0,
          );
        }
      };

      worker.postMessage("stop");
      worker.postMessage(`position fen ${fen}`);
      worker.postMessage(goCommand);
    });
  }

  return { ready, analyze, evaluateMove, evaluatePosition };
}
