import React, { useState, useEffect, useRef } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";

function App() {
  const [game, setGame] = useState(new Chess());
  const engineRef = useRef(null);
  const pendingFenRef = useRef(null);

  useEffect(() => {
    const engine = new Worker("/stockfish.js");
    engineRef.current = engine;

    engine.onmessage = (event) => {
      if (typeof event.data !== "string") return;
      const line = event.data.trim();

      if (line.startsWith("bestmove")) {
        const bestMove = line.split(" ")[1];
        if (!bestMove || bestMove === "(none)") return;

        setGame((prev) => {
          if (prev.isGameOver()) return prev;
          if (prev.fen() !== pendingFenRef.current) return prev; // stale, ignore
          const updated = new Chess(prev.fen());
          try {
            updated.move({
              from: bestMove.slice(0, 2),
              to: bestMove.slice(2, 4),
              promotion: "q",
            });
          } catch (e) {
            return prev;
          }
          return updated;
        });
      }
    };

    engine.postMessage("uci");
    engine.postMessage("isready");

    return () => engine.terminate();
  }, []);

  const onDrop = ({ sourceSquare, targetSquare }) => {
    let moved = false;

    setGame((prev) => {
      const updated = new Chess(prev.fen());
      let move;
      try {
        move = updated.move({
          from: sourceSquare,
          to: targetSquare,
          promotion: "q",
        });
      } catch (e) {
        return prev;
      }
      if (!move) return prev;
      moved = true;

      const fen = updated.fen();
      pendingFenRef.current = fen;
      setTimeout(() => {
        engineRef.current?.postMessage("stop");
        engineRef.current?.postMessage(`position fen ${fen}`);
        engineRef.current?.postMessage("go depth 15");
      }, 0);

      return updated;
    });

    return moved;
  };

  return (
    <Chessboard
      options={{
        draggable: true,
        onPieceDrop: onDrop,
        position: game.fen(),
      }}
    />
  );
}

export default App;
