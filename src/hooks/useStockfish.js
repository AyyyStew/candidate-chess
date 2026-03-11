import { useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";

export function useStockfish() {
  const analyzeWorkerRef = useRef(null);
  const evaluateWorkerRef = useRef(null);
  const positionWorkerRef = useRef(null);
  const readyCount = useRef(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    function makeWorker(multiPV) {
      const worker = new Worker("/stockfish.js");
      worker.postMessage("uci");
      worker.postMessage(`setoption name MultiPV value ${multiPV}`);
      worker.postMessage("isready");
      return worker;
    }

    function onReady(event) {
      if (typeof event.data !== "string") return;
      if (event.data.trim() === "readyok") {
        readyCount.current += 1;
        if (readyCount.current >= 3) setReady(true);
      }
    }

    const w1 = makeWorker(10);
    const w2 = makeWorker(1);
    const w3 = makeWorker(1);

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

  // Always returns white-perspective evals
  function getTopMoves(fen, topMovesCount, goCommand) {
    return new Promise((resolve) => {
      const worker = analyzeWorkerRef.current;
      const results = {};
      const depthMatch = goCommand.match(/depth (\d+)/);
      const targetDepth = depthMatch ? parseInt(depthMatch[1]) : null;
      const isBlack = fen.includes(" b ");

      worker.onmessage = (event) => {
        if (typeof event.data !== "string") return;
        const line = event.data.trim();

        if (line.startsWith("info") && line.includes("multipv")) {
          const pvMatch = line.match(/multipv (\d+).*pv (\S+)/);
          const scoreMatch = line.match(/score cp (-?\d+)/);
          const infoDepth = line.match(/depth (\d+)/);
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

            // always store as white-perspective
            const rawScore = parseInt(scoreMatch[1]) / 100;
            results[pvMatch[1]] = {
              move: uciMove,
              san,
              rawEval: isBlack ? -rawScore : rawScore,
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

  // Always returns white-perspective eval
  function getPositionEval(fen, goCommand) {
    return new Promise((resolve) => {
      const worker = positionWorkerRef.current;
      const isBlack = fen.includes(" b ");
      let lastEval = null;

      worker.onmessage = (event) => {
        if (typeof event.data !== "string") return;
        const line = event.data.trim();
        if (line.startsWith("info") && line.includes("score cp")) {
          const scoreMatch = line.match(/score cp (-?\d+)/);
          if (scoreMatch) lastEval = parseInt(scoreMatch[1]) / 100;
        }
        if (line.startsWith("bestmove")) {
          // flip if black — stockfish reports from side to move's perspective
          resolve(lastEval !== null ? (isBlack ? -lastEval : lastEval) : 0);
        }
      };

      worker.postMessage("stop");
      worker.postMessage(`position fen ${fen}`);
      worker.postMessage(goCommand);
    });
  }

  // Always returns white-perspective eval for a candidate move
  function getRawMoveEval(fen, move, goCommand) {
    return new Promise((resolve) => {
      const worker = evaluateWorkerRef.current;
      const game = new Chess(fen);
      const isBlack = fen.includes(" b ");
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
          // after the move it's opponent's turn, so flip back to white perspective
          const raw = lastEval !== null ? -lastEval : 0;
          resolve(isBlack ? -raw : raw);
        }
      };

      worker.postMessage("stop");
      worker.postMessage(`position fen ${fenAfter}`);
      worker.postMessage(goCommand);
    });
  }

  return { ready, getTopMoves, getPositionEval, getRawMoveEval };
}
