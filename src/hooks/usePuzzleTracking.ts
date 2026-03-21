import { useEffect, useRef } from "react";
import { trackPuzzleVisit, trackPuzzleSolve, saveSolve } from "../services/api";
import type { ApiUser } from "../services/api";
import type { GameSnapshot, Candidate } from "../types";

interface UsePuzzleTrackingOptions {
  snap: GameSnapshot | null;
  positionId: string | null;
  user: ApiUser | null;
  onStreakUpdate?: (participationStreak: number, winStreak: number) => void;
}

export function usePuzzleTracking({
  snap,
  positionId,
  user,
  onStreakUpdate,
}: UsePuzzleTrackingOptions) {
  const startTimeRef = useRef(Date.now());
  const visitedRef = useRef<string | null>(null);
  const solvedRef = useRef<string | null>(null);

  // Track puzzle visit once per position
  useEffect(() => {
    if (!positionId || visitedRef.current === positionId) return;
    visitedRef.current = positionId;
    startTimeRef.current = Date.now();
    solvedRef.current = null;
    trackPuzzleVisit(positionId);
  }, [positionId]);

  // Track solve when game ends
  useEffect(() => {
    if (
      !snap ||
      snap.phase !== "done" ||
      !positionId ||
      solvedRef.current === positionId
    )
      return;

    solvedRef.current = positionId;

    const resolved = snap.candidates.filter(
      (c: Candidate) => c.status !== "pending",
    );
    const hits = resolved.filter((c: Candidate) => c.status === "hit").length;

    const hiddenGemCandidates = resolved.filter(
      (c: Candidate) => c.status === "hidden_gem",
    );
    const hiddenGems =
      hiddenGemCandidates.length > 0
        ? JSON.stringify(
            hiddenGemCandidates.map((c) => ({
              move: c.move,
              san: c.san,
              eval: c.eval ?? null,
              diffBest: c.diffBest ?? null,
              diffPos: c.diffPos ?? null,
              depth: snap.engineDepth,
            })),
          )
        : null;

    const solveData = {
      strikesAllowed: snap.maxStrikes,
      strikesUsed: snap.strikes,
      movesFound: hits,
      targetMoves: snap.targetMoves,
      guesses: resolved.map((c: Candidate) => c.move).join(","),
      hiddenGems,
      timeMs: Date.now() - startTimeRef.current,
    };

    trackPuzzleSolve(positionId, solveData);
    if (user) {
      saveSolve(positionId, solveData).then((streaks) => {
        if (streaks && onStreakUpdate) {
          onStreakUpdate(streaks.participationStreak, streaks.winStreak);
        }
      });
    }
  }, [snap?.phase, positionId, user]);
}
