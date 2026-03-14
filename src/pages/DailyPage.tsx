import React, { useEffect, useRef, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { BoardProvider, useBoard } from "../contexts/BoardContext";
import { useEnginePool } from "../hooks/useEnginePool";
import { createEngineAnalysis } from "../engine/engineAnalysis";
import { buildFromPvs } from "../engine/engineCoordinator";
import { createGameSession } from "../sessions/GameSession";
import BoardPanel from "../components/BoardPanel";
import GamePanel from "../components/GamePanel";
import { getDailyPosition } from "../services/positionService";
import type { Position } from "../types";

interface DailyPageContentProps {
  daily: Position;
}

function DailyPageContent({ daily }: DailyPageContentProps) {
  const navigate = useNavigate();
  const board = useBoard();
  const engine = useEnginePool();
  const sessionRef = useRef(null);
  const [snap, setSnap] = useState(
    /** @type {import('../types').GameSnapshot|null} */ null,
  );
  const hasStartedRef = useRef(false);

  const goCommand = "go depth 15";

  useEffect(() => {
    if (!engine.ready || hasStartedRef.current) return;
    hasStartedRef.current = true;

    const analysis = createEngineAnalysis({ pool: engine, goCommand });
    if (daily.pvs && daily.pvs.length > 0) {
      const { topMoves, positionEval } = buildFromPvs(daily.fen, daily.pvs);
      analysis.loadPrecomputed(daily.fen, topMoves, positionEval);
    } else {
      analysis.startAnalysis(daily.fen);
    }

    const session = createGameSession({ analysis, position: daily });
    session.onChange = setSnap;
    sessionRef.current = session;
    setSnap(session.getSnapshot());
  }, [engine.ready]);

  if (!snap) {
    return (
      <main className="flex flex-col gap-4 p-8 max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-center underline mb-6">
          Daily Game
        </h1>
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-400 animate-pulse text-lg">
            Engine loading...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-4 p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-center underline mb-6">
        Daily Game
      </h1>
      <div className="flex gap-8">
        <BoardPanel
          snap={snap}
          onDrop={(from, to) => sessionRef.current.submitMove(from, to)}
          locked={true}
          onStudyFromPosition={() =>
            navigate("/study", { state: { fen: board.fen } })
          }
          gameInfo={
            <div className="text-right">
              <div className="font-semibold text-blue-700 dark:text-blue-200">
                {daily.label}
              </div>
              <div className="text-blue-600 dark:text-blue-300">
                {daily.event} — Move {daily.moveNumber}
              </div>
            </div>
          }
        />
        <div className="flex-1 flex flex-col gap-5">
          <GamePanel
            snap={snap}
            results={
              snap.phase === "done" ? sessionRef.current.getResults() : null
            }
            onNext={() => navigate("/random")}
            resetMessage="Play a Random Position"
          />
        </div>
      </div>
    </main>
  );
}

export default function DailyPage() {
  const [daily, setDaily] = useState<Position | null>(null);

  useEffect(() => {
    getDailyPosition().then((pos) => {
      if (pos) setDaily(pos);
    });
  }, []);
  if (!daily) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400 animate-pulse text-lg">Loading...</p>
      </div>
    );
  }

  return (
    <BoardProvider
      initialFen={daily.fen}
      initialOrientation={daily.orientation}
    >
      <DailyPageContent daily={daily} />
    </BoardProvider>
  );
}
