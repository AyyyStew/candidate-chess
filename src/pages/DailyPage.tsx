import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BoardProvider, useBoard } from "../contexts/BoardContext";
import { useEnginePool } from "../hooks/useEnginePool";
import { createEngineAnalysis } from "../engine/engineAnalysis";
import { buildFromPvs } from "../engine/engineCoordinator";
import { createGameSession } from "../sessions/GameSession";
import BoardPanel from "../components/BoardPanel";
import GamePanel from "../components/GamePanel";
import PositionBanner from "../components/PositionBanner";
import { getDailyPosition } from "../services/positionService";
import type { Position } from "../types";

const dateString = new Date().toLocaleDateString("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

interface DailyPageContentProps {
  daily: Position;
}

function DailyPageContent({ daily }: DailyPageContentProps) {
  const navigate = useNavigate();
  const board = useBoard();
  const engine = useEnginePool();
  const sessionRef = useRef(null);
  const [snap, setSnap] = useState(null);
  const hasStartedRef = useRef(false);

  useEffect(() => {
    if (!engine.ready || hasStartedRef.current) return;
    hasStartedRef.current = true;

    const analysis = createEngineAnalysis({ pool: engine, goCommand: "go depth 15" });
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

  return (
    <main className="max-w-6xl mx-auto px-8 py-8 flex flex-col gap-6">
      {/* Page title */}
      <div className="flex items-baseline justify-between">
        <h1 className="font-black text-3xl tracking-tight">Daily Challenge</h1>
        <span className="text-sm text-muted">{dateString}</span>
      </div>

      {/* Full-width position banner — spans both columns */}
      <PositionBanner
        label={daily.label}
        event={daily.event}
        moveNumber={daily.moveNumber}
        orientation={daily.orientation}
      />

      {/* Two-column content */}
      {!snap ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-muted animate-pulse">Engine loading...</p>
        </div>
      ) : (
        <div className="flex gap-8">
          <BoardPanel
            snap={snap}
            onDrop={(from, to) => sessionRef.current.submitMove(from, to)}
            locked={true}
            onStudyFromPosition={() =>
              navigate("/study", { state: { fen: board.fen } })
            }
          />
          <div className="flex-1 flex flex-col gap-5">
            <GamePanel
              snap={snap}
              onNext={() => navigate("/random")}
              resetMessage="Play a Random Position"
              showHeader={false}
            />
          </div>
        </div>
      )}
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
        <p className="text-muted animate-pulse text-lg">Loading...</p>
      </div>
    );
  }

  return (
    <BoardProvider initialFen={daily.fen} initialOrientation={daily.orientation}>
      <DailyPageContent daily={daily} />
    </BoardProvider>
  );
}
