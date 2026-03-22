import { useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import { useSessionSnapshot } from "../hooks/useSessionSnapshot";
import { useNavigate, useSearchParams } from "react-router-dom";
import DailyResultsModal from "../components/DailyResultsModal";
import StreakDisplay from "../components/StreakDisplay";
import { BoardProvider, useBoard } from "../contexts/BoardContext";
import { useEnginePool } from "../hooks/useEnginePool";
import {
  createEngineAnalysis,
  type EngineAnalysis,
} from "../engine/engineAnalysis";
import { buildFromPvs } from "../engine/engineCoordinator";
import { createGameSession, type GameSession } from "../sessions/GameSession";
import BoardPanel from "../components/BoardPanel";
import GamePanel from "../components/GamePanel";
import GameLayout from "../components/GameLayout";
import PositionBanner from "../components/PositionBanner";
import { getDailyPosition } from "../services/positionService";
import {
  getDailyRecord,
  saveDailyResult,
  type DailyRecord,
} from "../services/localDailyService";
import { useAuth } from "../contexts/AuthContext";
import { usePuzzleTracking } from "../hooks/usePuzzleTracking";
import { getDailySolve } from "../services/api";
import DiceIcon from "../components/DiceIcon";
import type { Position, Candidate } from "../types";
import { candidateToSquare } from "../utils/daily";
import GameResultsPanel from "../components/GameResultsPanel";
import NextDailyCountdown from "../components/NextDailyCountdown";

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

function DailyPageContent({
  daily,
  activeDate,
  existingRecord,
}: DailyPageContentProps) {
  const navigate = useNavigate();
  const board = useBoard();
  const engine = useEnginePool();
  const { user, updateUser } = useAuth();
  const [session, setSession] = useState<GameSession | null>(null);
  const [analysis, setAnalysis] = useState<EngineAnalysis | null>(null);
  const snap = useSessionSnapshot(session);
  const [showModal, setShowModal] = useState(false);
  const [record, setRecord] = useState<DailyRecord | null>(existingRecord);
  const hasStartedRef = useRef(false);
  const evaluatedMissesRef = useRef(false);

  const today = new Date().toISOString().slice(0, 10);
  const participationStreak = user?.participationStreak ?? 0;
  const winStreak = user?.winStreak ?? 0;

  // If user is logged in but localStorage was cleared, check backend
  useEffect(() => {
    if (!user || record) return;
    getDailySolve(activeDate).then((solve) => {
      if (!solve) return;
      const topMoves = daily.pvs?.length
        ? buildFromPvs(daily.fen, daily.pvs).topMoves
        : [];
      const answers = topMoves.slice(0, solve.targetMoves);
      const hitMoves = new Set(answers.map((m) => m.move));
      const hiddenGemMoves = new Set<string>(
        solve.hiddenGems
          ? (JSON.parse(solve.hiddenGems) as { move: string }[]).map(
              (g) => g.move,
            )
          : [],
      );
      const guessUcis = solve.guesses
        ? solve.guesses.split(",").filter(Boolean)
        : [];
      const candidates: Candidate[] = guessUcis.map((uci) => {
        const top = topMoves.find((m) => m.move === uci);
        const status = hitMoves.has(uci)
          ? "hit"
          : hiddenGemMoves.has(uci)
            ? "hidden_gem"
            : "miss";
        let san = top?.san ?? uci;
        if (!top) {
          try {
            const parsed = new Chess(daily.fen).move({
              from: uci.slice(0, 2),
              to: uci.slice(2, 4),
              promotion: uci[4] ?? "q",
            });
            if (parsed) san = parsed.san;
          } catch {
            /* keep uci */
          }
        }
        return {
          move: uci,
          san,
          status,
          eval: top?.eval,
          diffBest: top?.diffBest,
          diffPos: top?.diffPos,
          category: top?.category,
          line: top?.line,
        };
      });
      const squares = candidates.map((c) => candidateToSquare(c, topMoves));
      setRecord({
        date: activeDate,
        fen: daily.fen,
        hits: solve.movesFound,
        target: solve.targetMoves,
        won: solve.movesFound >= solve.targetMoves,
        squares,
        candidates,
        answers,
      });
    });
  }, [user]);

  usePuzzleTracking({
    snap,
    positionId: daily.id,
    user,
    onStreakUpdate: (participationStreak, winStreak) =>
      updateUser({ participationStreak, winStreak }),
  });

  useEffect(() => {
    if (hasStartedRef.current) return;

    const hasPVs = daily.pvs && daily.pvs.length > 0;
    // If no precomputed PVs, we need the engine to be ready before starting
    if (!hasPVs && !engine.ready) return;

    hasStartedRef.current = true;

    const newAnalysis = createEngineAnalysis({
      pool: engine,
      goCommand: "go depth 15",
    });
    if (hasPVs) {
      const { topMoves, positionEval } = buildFromPvs(daily.fen, daily.pvs);
      newAnalysis.loadPrecomputed(daily.fen, topMoves, positionEval);
    } else {
      newAnalysis.startAnalysis(daily.fen);
    }

    setAnalysis(newAnalysis);
    const newSession = createGameSession({
      analysis: newAnalysis,
      position: daily,
    });
    setSession(newSession);

    // Results shown inline for already-played dates — no auto-modal
  }, [engine.ready]);

  // Evaluate miss candidates from backend-reconstructed record using browser engine
  useEffect(() => {
    if (!analysis || !record || evaluatedMissesRef.current) return;
    const misses = record.candidates.filter(
      (c) => c.status === "miss" && c.eval === undefined,
    );
    if (misses.length === 0) {
      evaluatedMissesRef.current = true;
      return;
    }
    evaluatedMissesRef.current = true;
    Promise.all(misses.map((c) => analysis.evaluateMove(c.move, c.san))).then(
      (results) => {
        const evalMap = new Map(results.map((r) => [r.move, r]));
        setRecord((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            candidates: prev.candidates.map((c) => {
              const ev = evalMap.get(c.move);
              return ev
                ? {
                    ...c,
                    eval: ev.eval,
                    diffBest: ev.diffBest,
                    diffPos: ev.diffPos,
                    category: ev.category,
                    line: ev.line,
                  }
                : c;
            }),
          };
        });
      },
    );
  }, [analysis, record]);

  useEffect(() => {
    if (snap?.phase !== "done" || existingRecord || activeDate !== today)
      return;

    const resolved = snap.candidates.filter(
      (c: Candidate) => c.status !== "pending",
    );
    const hits = resolved.filter((c: Candidate) => c.status === "hit").length;
    const squares = resolved.map((c: Candidate) =>
      candidateToSquare(c, snap.liveTopMoves),
    );

    const newRecord: DailyRecord = {
      date: activeDate,
      fen: snap.fen,
      hits,
      target: snap.targetMoves,
      won: hits >= snap.targetMoves,
      squares,
      candidates: resolved,
      answers: snap.liveTopMoves.slice(0, snap.targetMoves),
    };
    saveDailyResult(newRecord);
    setRecord(newRecord);

    const t = setTimeout(() => setShowModal(true), 800);
    return () => clearTimeout(t);
  }, [snap?.phase]);

  const boardSnap = useMemo(
    () =>
      record && snap
        ? {
            ...snap,
            phase: "done" as const,
            liveTopMoves: record.answers,
            candidates: record.candidates,
          }
        : snap,
    [record, snap],
  );

  return (
    <>
      {showModal && (
        <DailyResultsModal
          activeDate={activeDate}
          participationStreak={user ? participationStreak : undefined}
          winStreak={user ? winStreak : undefined}
          onClose={() => setShowModal(false)}
          snap={record ? undefined : snap}
          record={record ?? undefined}
        />
      )}
      <main className="max-w-6xl mx-auto px-8 py-8 flex flex-col gap-6">
        {/* Page title */}
        <div className="flex flex-row items-baseline justify-between gap-2 sm:gap-0">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-baseline gap-2 sm:gap-4">
              <h1 className="font-black text-xl sm:text-3xl tracking-tight">
                Daily Challenge
              </h1>
              {user && (
                <StreakDisplay
                  participationStreak={participationStreak}
                  winStreak={winStreak}
                />
              )}
            </div>
            <NextDailyCountdown />
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {existingRecord && (
              <button
                onClick={() => setShowModal(true)}
                className="text-xs text-faint hover:text-label transition-colors underline underline-offset-2"
              >
                View results
              </button>
            )}
            <span className="text-xs sm:text-sm text-muted">
              {formatDateString(activeDate)}
            </span>
          </div>
        </div>

        {/* Full-width position banner */}
        <PositionBanner
          label={daily.label}
          event={daily.event}
          moveNumber={daily.moveNumber}
          orientation={daily.orientation}
          pgn={daily.pgn}
        />

        {/* Two-column on desktop, mobile-stacked on small screens */}
        {!snap ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-muted animate-pulse">Engine loading...</p>
          </div>
        ) : (
          <GameLayout
            snap={snap}
            activeGame={!record}
            board={
              <BoardPanel
                snap={boardSnap}
                onDrop={
                  record
                    ? undefined
                    : (from, to) => session?.submitMove(from, to)
                }
                locked={true}
                onStudyFromPosition={() =>
                  navigate("/study", { state: { fen: board.fen } })
                }
                onPlayFromPosition={() =>
                  navigate("/custom", { state: { fen: board.fen } })
                }
              />
            }
            panel={
              record && boardSnap ? (
                <GameResultsPanel
                  snap={boardSnap}
                  shareTitle={`Daily \u2013 ${new Date(activeDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
                  shareUrl={`${window.location.origin}/?date=${activeDate}`}
                  extraHeader={
                    user && (
                      <StreakDisplay
                        participationStreak={participationStreak}
                        winStreak={winStreak}
                      />
                    )
                  }
                  primaryAction={{
                    label: "Play a Random Position",
                    icon: DiceIcon,
                    href: "/random",
                    onClick: () => navigate("/random"),
                  }}
                />
              ) : (
                <GamePanel snap={snap} />
              )
            }
          />
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
    dateParam && isValidDate(dateParam) && dateParam <= todayString
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
          <p className="text-sm text-muted">
            {redirectReason} Showing today's challenge.
          </p>
        )}
        <p className="text-muted animate-pulse text-lg">Loading...</p>
      </div>
    );
  }

  const existingRecord = getDailyRecord(activeDate);

  return (
    <BoardProvider
      key={activeDate}
      initialFen={daily.fen}
      initialOrientation={daily.orientation}
    >
      {redirectReason && (
        <div className="max-w-6xl mx-auto px-8 pt-6">
          <p className="text-sm text-muted">
            {redirectReason} Showing today's challenge.
          </p>
        </div>
      )}
      <DailyPageContent
        daily={daily}
        activeDate={activeDate}
        existingRecord={existingRecord}
      />
    </BoardProvider>
  );
}
