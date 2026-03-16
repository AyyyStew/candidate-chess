import type { GameSnapshot } from "../types";
import { PipsIndicator, StrikeIndicator } from "./PipsAndStrikes";

interface Props {
  snap: GameSnapshot;
}

export default function StrikesPipsBar({ snap }: Props) {
  const isDone = snap.phase === "done";
  const hitCount = snap.candidates.filter((c) => c.status === "hit").length;

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-edge-hi bg-surface px-4 py-3">
      <PipsIndicator
        analysisReady={snap.analysisReady}
        isDone={isDone}
        targetMoves={snap.targetMoves}
        hitCount={hitCount}
      />
      <StrikeIndicator strikes={snap.strikes} maxStrikes={snap.maxStrikes} size="sm" />
    </div>
  );
}
