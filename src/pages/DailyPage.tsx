import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import DailyResultsModal from "../components/DailyResultsModal";
import StreakDisplay from "../components/StreakDisplay";
import { BoardProvider, useBoard } from "../contexts/BoardContext";
import { useEnginePool } from "../hooks/useEnginePool";
import { createEngineAnalysis } from "../engine/engineAnalysis";
import { buildFromPvs } from "../engine/engineCoordinator";
import { createGameSession } from "../sessions/GameSession";
import BoardPanel from "../components/BoardPanel";
import GamePanel from "../components/GamePanel";
import PositionBanner from "../components/PositionBanner";
import { getDailyPosition } from "../services/positionService";
import {
  getDailyRecord,
  saveDailyResult,
  getParticipationStreak,
  getWinStreak,
  type DailyRecord,
} from "../services/dailyStatsService";
import type { Position, Candidate, TopMove } from "../types";
import DailyResultsPanel from "../components/DailyResultsPanel";

const RANK_EMOJI = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣"];

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
  existingRecord: DailyRecord | null;
}

function DailyPageContent({ daily, activeDate, existingRecord }: DailyPageContentProps) {
  const navigate = useNavigate();
  const board = useBoard();
  const engine = useEnginePool();
  const sessionRef = useRef(null);
  const [snap, setSnap] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [record, setRecord] = useState<DailyRecord | null>(existingRecord);
  const hasStartedRef = useRef(false);

  const today = new Date().toISOString().split("T")[0];
  const participationStreak = getParticipationStreak(today);
  const winStreak = getWinStreak(today);

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

    // Results shown inline for already-played dates — no auto-modal
  }, [engine.ready]);

  useEffect(() => {
    if (snap?.phase !== "done" || existingRecord || activeDate !== today) return;

    const resolved = snap.candidates.filter((c: Candidate) => !c.pending);
    const hits = resolved.filter((c: Candidate) => c.isHit).length;
    const squares = resolved.map((c: Candidate) => {
      if (!c.isHit) return "🟥";
      return c.rank != null && c.rank >= 1 && c.rank <= 5 ? RANK_EMOJI[c.rank - 1] : "🟩";
    });
    const storedCandidates = resolved.map((c: Candidate) => ({
      san: c.san,
      isHit: !!c.isHit,
      rank: c.rank ?? null,
      category: c.category ?? null,
      eval: c.eval ?? null,
    }));

    const answers = snap.liveTopMoves.slice(0, snap.targetMoves).map((m: TopMove, i: number) => ({
      san: m.san,
      isHit: true,
      rank: i + 1,
      category: m.category ?? null,
      eval: m.eval ?? null,
    }));

    const newRecord: DailyRecord = {
      date: activeDate,
      hits,
      target: snap.targetMoves,
      won: hits >= snap.targetMoves,
      squares,
      candidates: storedCandidates,
      answers,
    };
    saveDailyResult(newRecord);
    setRecord(newRecord);

    const t = setTimeout(() => setShowModal(true), 800);
    return () => clearTimeout(t);
  }, [snap?.phase]);

  return (
    <>
      {showModal && (
        <DailyResultsModal
          activeDate={activeDate}
          participationStreak={participationStreak}
          winStreak={winStreak}
          onClose={() => setShowModal(false)}
          snap={record ? undefined : snap}
          record={record ?? undefined}
        />
      )}
      <main className="max-w-6xl mx-auto px-8 py-8 flex flex-col gap-6">
        {/* Page title */}
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-4">
            <h1 className="font-black text-3xl tracking-tight">Daily Challenge</h1>
            <StreakDisplay participationStreak={participationStreak} winStreak={winStreak} />
          </div>
          <div className="flex items-center gap-3">
            {existingRecord && (
              <button
                onClick={() => setShowModal(true)}
                className="text-xs text-faint hover:text-label transition-colors underline underline-offset-2"
              >
                View results
              </button>
            )}
            <span className="text-sm text-muted">{formatDateString(activeDate)}</span>
          </div>
        </div>

        {/* Full-width position banner */}
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
              onDrop={existingRecord ? undefined : (from, to) => sessionRef.current.submitMove(from, to)}
              locked={true}
              onStudyFromPosition={() => navigate("/study", { state: { fen: board.fen } })}
            />
            <div className="flex-1 flex flex-col gap-5">
              {record ? (
                <DailyResultsPanel
                  record={record}
                  participationStreak={participationStreak}
                  winStreak={winStreak}
                  onShare={() => setShowModal(true)}
                />
              ) : (
                <GamePanel
                  snap={snap}
                  onNext={() => navigate("/random")}
                  resetMessage="Play a Random Position"
                  showHeader={false}
                />
              )}
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
  const activeDate =
    dateParam && isValidDate(dateParam) && dateParam <= todayString ? dateParam : todayString;

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

  const existingRecord = getDailyRecord(activeDate);

  return (
    <BoardProvider key={activeDate} initialFen={daily.fen} initialOrientation={daily.orientation}>
      {redirectReason && (
        <div className="max-w-6xl mx-auto px-8 pt-6">
          <p className="text-sm text-muted">{redirectReason} Showing today's challenge.</p>
        </div>
      )}
      <DailyPageContent daily={daily} activeDate={activeDate} existingRecord={existingRecord} />
    </BoardProvider>
  );
}
