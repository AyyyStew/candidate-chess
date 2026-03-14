import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import DailyResultsModal from "../components/DailyResultsModal";
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

function formatDateString(isoDate: string): string {
  return new Date(isoDate + "T00:00:00").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

interface DailyPageContentProps {
  daily: Position;
  activeDate: string;
}

function DailyPageContent({ daily, activeDate }: DailyPageContentProps) {
  const navigate = useNavigate();
  const board = useBoard();
  const engine = useEnginePool();
  const sessionRef = useRef(null);
  const [snap, setSnap] = useState(null);
  const [showModal, setShowModal] = useState(false);
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

  useEffect(() => {
    if (snap?.phase !== "done") return;
    const t = setTimeout(() => setShowModal(true), 800);
    return () => clearTimeout(t);
  }, [snap?.phase]);

  return (
    <>
    {showModal && snap && (
      <DailyResultsModal
        snap={snap}
        activeDate={activeDate}
        onClose={() => setShowModal(false)}
      />
    )}
    <main className="max-w-6xl mx-auto px-8 py-8 flex flex-col gap-6">
      {/* Page title */}
      <div className="flex items-baseline justify-between">
        <h1 className="font-black text-3xl tracking-tight">Daily Challenge</h1>
        <span className="text-sm text-muted">{formatDateString(activeDate)}</span>
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
    </>
  );
}

function isValidDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(new Date(date).getTime());
}

export default function DailyPage() {
  const [daily, setDaily] = useState<Position | null>(null);
  const [redirectReason, setRedirectReason] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const dateParam = searchParams.get("date");
  const todayString = new Date().toISOString().split("T")[0];
  const activeDate = dateParam && isValidDate(dateParam) && dateParam <= todayString
    ? dateParam
    : todayString;

  useEffect(() => {
    if (dateParam) {
      if (!isValidDate(dateParam)) {
        setRedirectReason("That date wasn't valid.");
        navigate(`/?date=${todayString}`, { replace: true });
        return;
      }
      if (dateParam > todayString) {
        setRedirectReason("No peeking into the future.");
        navigate(`/?date=${todayString}`, { replace: true });
        return;
      }
    }

    getDailyPosition(activeDate).then((pos) => {
      if (pos) {
        setDaily(pos);
        if (!dateParam) {
          setSearchParams({ date: todayString }, { replace: true });
        }
      }
    });
  }, [dateParam]);

  if (!daily) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        {redirectReason && (
          <p className="text-sm text-muted">{redirectReason} Showing today's challenge.</p>
        )}
        <p className="text-muted animate-pulse text-lg">Loading...</p>
      </div>
    );
  }

  return (
    <BoardProvider initialFen={daily.fen} initialOrientation={daily.orientation}>
      {redirectReason && (
        <div className="max-w-6xl mx-auto px-8 pt-6">
          <p className="text-sm text-muted">{redirectReason} Showing today's challenge.</p>
        </div>
      )}
      <DailyPageContent daily={daily} activeDate={activeDate} />
    </BoardProvider>
  );
}
