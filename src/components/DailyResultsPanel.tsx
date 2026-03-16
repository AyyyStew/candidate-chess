import type { DailyRecord } from "../services/dailyStatsService";
import StreakDisplay from "./StreakDisplay";
import MoveRowCard from "./MoveRowCard";

interface DailyResultsPanelProps {
  record: DailyRecord;
  participationStreak: number;
  winStreak: number;
  onShare: () => void;
  onPlayRandom?: () => void;
}

export default function DailyResultsPanel({
  record,
  participationStreak,
  winStreak,
  onShare,
  onPlayRandom,
}: DailyResultsPanelProps) {
  const misses = record.candidates.filter((c) => c.status === "miss");
  const foundMoves = new Set(
    record.candidates.filter((c) => c.status === "hit").map((c) => c.move),
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Score + squares */}
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-black text-text">{record.hits}</span>
          <span className="text-base text-muted">
            / {record.target} moves found
          </span>
        </div>
        <div className="flex gap-1.5 text-xl">
          {record.squares.map((s, i) => (
            <span key={i}>{s}</span>
          ))}
          {Array.from({
            length: Math.max(0, record.target - record.squares.length),
          })}
        </div>
      </div>

      {/* Streaks */}
      {(participationStreak > 0 || winStreak > 0) && (
        <StreakDisplay
          participationStreak={participationStreak}
          winStreak={winStreak}
        />
      )}

      {/* Answers in rank order */}
      {record.answers.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-faint uppercase tracking-widest">
            Top moves
          </p>
          <div className="flex flex-col gap-1.5">
            {record.answers.map((answer, i) => (
              <MoveRowCard
                key={i}
                rank={i + 1}
                san={answer.san}
                category={answer.category}
                eval={answer.eval}
                isHit={foundMoves.has(answer.move)}
                pvLine={answer.line}
                startFen={record.fen}
                showLine={true}
              />
            ))}
          </div>
        </div>
      )}

      {/* Misses */}
      {misses.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-faint uppercase tracking-widest">Misses</p>
          <div className="flex flex-col gap-1.5">
            {misses.map((c, i) => (
              <MoveRowCard
                key={i}
                rank="miss"
                san={c.san}
                category={c.category}
                eval={c.eval}
              />
            ))}
          </div>
        </div>
      )}

      {/* Share */}
      <button
        onClick={onShare}
        className="mt-auto w-full py-3 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 bg-interactive hover:bg-interactive-hi transition-colors text-label"
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="9" y="2" width="6" height="4" rx="1" />
          <path d="M9 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2h-3" />
        </svg>
        Share result
      </button>

      {onPlayRandom && (
        <button
          onClick={onPlayRandom}
          className="w-full py-3 rounded-xl font-bold text-base bg-accent hover:bg-accent-hi text-white transition-all shadow-lg shadow-accent/25 hover:shadow-accent/40"
        >
          Play a Random Position
        </button>
      )}
    </div>
  );
}
